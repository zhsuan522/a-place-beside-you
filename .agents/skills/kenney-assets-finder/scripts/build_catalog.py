#!/usr/bin/env python3
"""Build a Phaser-friendly inventory from prepared Kenney pack manifests."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.parse import quote

from common import AssetWorkflowError, DEFAULT_PACKS_ROOT, resolve_path, validate_slug


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
AUDIO_EXTENSIONS = {".wav", ".mp3", ".ogg", ".m4a", ".flac"}
FONT_EXTENSIONS = {".ttf", ".otf", ".woff", ".woff2"}
TILEMAP_EXTENSIONS = {".tmx", ".tsx", ".tmj", ".tsj"}
DATA_EXTENSIONS = {".json", ".csv", ".xml", ".yaml", ".yml"}


def asset_type(extension: str) -> str:
    if extension in IMAGE_EXTENSIONS:
        return "image"
    if extension in AUDIO_EXTENSIONS:
        return "audio"
    if extension in FONT_EXTENSIONS:
        return "font"
    if extension in TILEMAP_EXTENSIONS:
        return "tilemap"
    if extension in DATA_EXTENSIONS:
        return "data"
    return "other"


def safe_file(pack_dir: Path, relative_name: str) -> tuple[PurePosixPath, Path]:
    relative = PurePosixPath(relative_name)
    if (
        relative.is_absolute()
        or not relative.parts
        or any(part in ("", ".", "..") for part in relative.parts)
        or "\\" in relative_name
    ):
        raise AssetWorkflowError(f"Unsafe path in pack manifest: {relative_name!r}.")
    current = pack_dir
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise AssetWorkflowError(f"Manifest path contains a symlink: {current}.")
    if not current.is_file():
        raise AssetWorkflowError(f"Manifest file is missing: {current}.")
    return relative, current


def build_pack_entry(pack_dir: Path, packs_root: Path, manifest: dict) -> dict:
    slug = validate_slug(str(manifest.get("packSlug", "")))
    if pack_dir.name != slug:
        raise AssetWorkflowError(
            f"Manifest slug {slug!r} does not match folder {pack_dir.name!r}."
        )
    indexed_files = manifest.get("files")
    if not isinstance(indexed_files, list):
        raise AssetWorkflowError(f"Manifest has no valid files list: {pack_dir}.")

    files = []
    counts: dict[str, int] = {}
    for item in indexed_files:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            raise AssetWorkflowError(f"Invalid file entry in {pack_dir / 'pack-manifest.json'}.")
        relative, file_path = safe_file(pack_dir, item["path"])
        extension = file_path.suffix.lower()
        kind = asset_type(extension)
        counts[kind] = counts.get(kind, 0) + 1

        project_relative = PurePosixPath("assets") / "packs" / "kenney" / slug / relative
        runtime_url = "/" + quote(project_relative.as_posix(), safe="/-_.~")
        entry = {
            "path": relative.as_posix(),
            "url": runtime_url,
            "type": kind,
            "extension": extension,
            "sizeBytes": file_path.stat().st_size,
            "sha256": item.get("sha256"),
        }
        for dimension in ("imageWidth", "imageHeight"):
            if isinstance(item.get(dimension), int):
                entry[dimension] = item[dimension]
        files.append(entry)

    return {
        "slug": slug,
        "name": manifest.get("packName") or slug,
        "sourcePage": manifest.get("sourcePage"),
        "licenseStatus": manifest.get("licenseStatus", "unknown"),
        "licenseFiles": manifest.get("licenseFiles", []),
        "archive": manifest.get("archive"),
        "fileCount": len(files),
        "fileCountsByType": dict(sorted(counts.items())),
        "files": sorted(files, key=lambda file: file["path"].casefold()),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a JSON catalog for prepared Kenney packs under public/assets."
    )
    parser.add_argument(
        "--packs-root",
        default=str(DEFAULT_PACKS_ROOT),
        help="Pack directory (default: public/assets/packs/kenney).",
    )
    parser.add_argument(
        "--output",
        help="Catalog output path (default: <packs-root>/catalog.json).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        packs_root = resolve_path(args.packs_root)
        if not packs_root.exists() or not packs_root.is_dir():
            raise AssetWorkflowError(f"Kenney packs folder does not exist: {packs_root}.")

        output_path = resolve_path(args.output) if args.output else packs_root / "catalog.json"
        packs = []
        unindexed_folders = []
        for pack_dir in sorted(packs_root.iterdir(), key=lambda path: path.name.casefold()):
            if not pack_dir.is_dir() or pack_dir.is_symlink():
                continue
            manifest_path = pack_dir / "pack-manifest.json"
            if not manifest_path.exists():
                unindexed_folders.append(pack_dir.name)
                continue
            if manifest_path.is_symlink():
                raise AssetWorkflowError(f"Pack manifest is a symlink: {manifest_path}.")
            try:
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                raise AssetWorkflowError(f"Could not read manifest {manifest_path}: {exc}") from exc
            packs.append(build_pack_entry(pack_dir, packs_root, manifest))

        catalog = {
            "schemaVersion": 1,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "packCount": len(packs),
            "unindexedPackFolders": sorted(unindexed_folders),
            "packs": packs,
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = output_path.with_name(f".{output_path.name}.tmp")
        if temporary_path.is_symlink() or output_path.is_symlink():
            raise AssetWorkflowError("Catalog output path must not be a symlink.")
        temporary_path.write_text(
            json.dumps(catalog, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        temporary_path.replace(output_path)
        print(f"Catalog created: {output_path}")
        print(f"Prepared packs indexed: {len(packs)}")
        if unindexed_folders:
            print(f"Folders without a manifest: {', '.join(sorted(unindexed_folders))}")
        return 0
    except (AssetWorkflowError, OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
