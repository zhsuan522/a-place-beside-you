#!/usr/bin/env python3
"""Verify, safely extract, and index a Kenney ZIP pack."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

from common import (
    AssetWorkflowError,
    DEFAULT_PACKS_ROOT,
    image_dimensions,
    inspect_zip,
    resolve_path,
    sha256_file,
    validate_official_page_url,
    validate_slug,
    verify_zip_crc,
)


LICENSE_NAME = re.compile(r"^licen[cs]e(?:$|[._-])", re.IGNORECASE)


def ensure_no_symlink_path(root: Path, relative: PurePosixPath) -> Path:
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise AssetWorkflowError(f"Destination contains a symlink: {current}.")
    return current


def read_download_metadata(pack_dir: Path, archive: Path, archive_hash: str) -> dict:
    sidecar = pack_dir / ".kenney-download.json"
    if sidecar.is_symlink():
        raise AssetWorkflowError("Download metadata file must not be a symlink.")
    if not sidecar.exists():
        return {}
    try:
        metadata = json.loads(sidecar.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AssetWorkflowError(f"Could not read download metadata: {exc}") from exc
    if metadata.get("archiveName") != archive.name:
        return {}
    if metadata.get("archiveSha256") != archive_hash:
        raise AssetWorkflowError("Download metadata hash does not match the selected ZIP.")
    if metadata.get("sourcePage"):
        metadata["sourcePage"] = validate_official_page_url(metadata["sourcePage"])
    return metadata


def extract_to_stage(archive_path: Path, entries: list[zipfile.ZipInfo], stage: Path) -> list[dict]:
    files: list[dict] = []
    with zipfile.ZipFile(archive_path) as archive:
        for info in entries:
            relative = PurePosixPath(info.filename)
            destination = stage.joinpath(*relative.parts)
            if info.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info, "r") as source, destination.open("xb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)

    for path in sorted(stage.rglob("*")):
        if not path.is_file():
            continue
        relative = PurePosixPath(path.relative_to(stage).as_posix())
        dimensions = image_dimensions(path)
        item = {
            "path": relative.as_posix(),
            "sizeBytes": path.stat().st_size,
            "sha256": sha256_file(path),
            "extension": path.suffix.lower(),
        }
        if dimensions:
            item["imageWidth"], item["imageHeight"] = dimensions
        files.append(item)
    return files


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verify a Kenney ZIP, preserve it, and extract it into the Kenney asset folder."
    )
    parser.add_argument("archive", help="Path to the downloaded .zip archive.")
    parser.add_argument("--slug", required=True, help="Pack destination slug, such as tiny-dungeon.")
    parser.add_argument("--name", help="Exact English pack name for the generated manifest.")
    parser.add_argument("--source-page", help="Official Kenney product page.")
    parser.add_argument(
        "--packs-root",
        default=str(DEFAULT_PACKS_ROOT),
        help="Pack directory (default: public/assets/packs/kenney).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        raw_archive = Path(args.archive).expanduser()
        if raw_archive.is_symlink():
            raise AssetWorkflowError("Archive must not be a symlink.")
        archive_path = resolve_path(raw_archive)
        slug = validate_slug(args.slug)
        source_page = (
            validate_official_page_url(args.source_page) if args.source_page else None
        )
        packs_root = resolve_path(args.packs_root)
        packs_root.mkdir(parents=True, exist_ok=True)
        pack_dir = packs_root / slug
        if pack_dir.is_symlink():
            raise AssetWorkflowError("Destination pack folder must not be a symlink.")
        if pack_dir.exists() and not pack_dir.is_dir():
            raise AssetWorkflowError("Destination pack path exists and is not a folder.")
        pack_dir.mkdir(parents=True, exist_ok=True)

        entries = inspect_zip(archive_path)
        verify_zip_crc(archive_path)
        for info in entries:
            parts = PurePosixPath(info.filename).parts
            if len(parts) == 1 and parts[0].casefold() in {
                "pack-manifest.json",
                ".kenney-download.json",
            }:
                raise AssetWorkflowError(
                    f"Archive uses a reserved workflow filename: {info.filename!r}."
                )
        archive_hash = sha256_file(archive_path)
        download_metadata = read_download_metadata(pack_dir, archive_path, archive_hash)
        if source_page is None:
            source_page = download_metadata.get("sourcePage")

        archive_in_pack = pack_dir / archive_path.name
        if archive_in_pack.is_symlink():
            raise AssetWorkflowError("Destination archive path is a symlink.")
        if archive_path != archive_in_pack.resolve(strict=False) and archive_in_pack.exists():
            if not archive_in_pack.is_file() or sha256_file(archive_in_pack) != archive_hash:
                raise AssetWorkflowError(
                    f"A different archive already exists at {archive_in_pack}; it was left unchanged."
                )

        with tempfile.TemporaryDirectory(
            prefix=f".{slug}-stage-", dir=str(packs_root)
        ) as temporary_directory:
            stage = Path(temporary_directory)
            files = extract_to_stage(archive_path, entries, stage)
            if not files:
                raise AssetWorkflowError("Archive contains no files to extract.")

            files_to_copy: list[tuple[Path, Path]] = []
            for item in files:
                relative = PurePosixPath(item["path"])
                source = stage.joinpath(*relative.parts)
                destination = ensure_no_symlink_path(pack_dir, relative)
                cursor = pack_dir
                for part in relative.parts[:-1]:
                    cursor = cursor / part
                    if cursor.exists() and not cursor.is_dir():
                        raise AssetWorkflowError(
                            f"An existing file blocks extraction at {cursor}."
                        )
                if destination.exists():
                    if not destination.is_file():
                        raise AssetWorkflowError(
                            f"An existing folder blocks extraction at {destination}."
                        )
                    if sha256_file(destination) != item["sha256"]:
                        raise AssetWorkflowError(
                            f"Existing file differs from the ZIP: {destination}; it was left unchanged."
                        )
                else:
                    files_to_copy.append((source, destination))

            existing_manifest = pack_dir / "pack-manifest.json"
            if existing_manifest.is_symlink():
                raise AssetWorkflowError("Manifest path is a symlink.")

            if archive_path != archive_in_pack.resolve(strict=False) and not archive_in_pack.exists():
                shutil.copy2(archive_path, archive_in_pack)

            for _, destination in files_to_copy:
                destination.parent.mkdir(parents=True, exist_ok=True)
            for source, destination in files_to_copy:
                shutil.copy2(source, destination)

        license_files = [
            item["path"]
            for item in files
            if LICENSE_NAME.match(PurePosixPath(item["path"]).name)
        ]
        manifest = {
            "schemaVersion": 1,
            "packSlug": slug,
            "packName": args.name or slug.replace("-", " ").title(),
            "sourcePage": source_page,
            "preparedAt": datetime.now(timezone.utc).isoformat(),
            "archive": {
                "name": archive_in_pack.name,
                "sizeBytes": archive_in_pack.stat().st_size,
                "sha256": sha256_file(archive_in_pack),
            },
            "licenseFiles": license_files,
            "licenseStatus": "present" if license_files else "missing",
            "fileCount": len(files),
            "files": files,
        }
        if download_metadata.get("downloadedAt"):
            manifest["downloadedAt"] = download_metadata["downloadedAt"]

        manifest_path = pack_dir / "pack-manifest.json"
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            newline="\n",
            prefix=".pack-manifest-",
            suffix=".tmp",
            dir=pack_dir,
            delete=False,
        ) as stream:
            json.dump(manifest, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
            temporary_manifest = Path(stream.name)
        temporary_manifest.replace(manifest_path)

        print(f"Prepared pack: {pack_dir}")
        print(f"Files indexed: {len(files)}")
        print(f"License files: {len(license_files)} ({manifest['licenseStatus']})")
        print(f"Manifest: {manifest_path}")
        if files_to_copy:
            print(f"New files extracted: {len(files_to_copy)}")
        else:
            print("Extracted files already matched the archive; no duplicates were written.")
        return 0
    except (AssetWorkflowError, OSError, zipfile.BadZipFile, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
