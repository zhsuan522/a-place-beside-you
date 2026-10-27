#!/usr/bin/env python3
"""Download a Kenney ZIP from an explicitly verified official pack page."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from email.message import Message
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from common import (
    AssetWorkflowError,
    DEFAULT_PACKS_ROOT,
    resolve_path,
    sha256_file,
    validate_download_url,
    validate_official_page_url,
    validate_slug,
    verify_zip_crc,
)


class KenneyRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        validate_download_url(new_url)
        return super().redirect_request(request, response, code, message, headers, new_url)


def suggested_filename(headers, final_url: str) -> str:
    raw = headers.get("Content-Disposition", "")
    message = Message()
    if raw:
        message["content-disposition"] = raw
    name = message.get_filename()
    if not name:
        name = unquote(urlsplit(final_url).path.rsplit("/", 1)[-1])
    name = name.replace("\\", "/").rsplit("/", 1)[-1]
    name = re.sub(r"[^A-Za-z0-9._ -]", "_", name).strip(" .")
    if not name:
        name = "kenney-pack.zip"
    if not name.lower().endswith(".zip"):
        name += ".zip"
    return name


def download(url: str, target: Path, max_bytes: int, timeout: int) -> tuple[int, str, str]:
    request = Request(
        url,
        headers={"User-Agent": "KenneyAssetWorkflow/1.0"},
        method="GET",
    )
    opener = build_opener(KenneyRedirectHandler())
    digest = hashlib.sha256()
    total = 0
    with opener.open(request, timeout=timeout) as response, target.open("wb") as output:
        validate_download_url(response.geturl())
        filename = suggested_filename(response.headers, response.geturl())
        header_size = response.headers.get("Content-Length")
        if header_size:
            try:
                if int(header_size) > max_bytes:
                    raise AssetWorkflowError(
                        f"Download exceeds the configured limit ({max_bytes} bytes)."
                    )
            except ValueError:
                pass
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise AssetWorkflowError(
                    f"Download exceeds the configured limit ({max_bytes} bytes)."
                )
            output.write(chunk)
            digest.update(chunk)
        output.flush()
        os.fsync(output.fileno())
    if total == 0:
        raise AssetWorkflowError("The server returned an empty download.")
    return total, digest.hexdigest(), filename


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download a ZIP from Kenney's official site or Kenney's itch.io account."
    )
    parser.add_argument("--url", required=True, help="Direct HTTPS ZIP URL copied from the official page.")
    parser.add_argument("--source-page", required=True, help="Official Kenney pack page used to verify the download.")
    parser.add_argument("--slug", required=True, help="Destination folder name, such as tiny-dungeon.")
    parser.add_argument(
        "--packs-root",
        default=str(DEFAULT_PACKS_ROOT),
        help="Pack directory (default: public/assets/packs/kenney).",
    )
    parser.add_argument("--max-mb", type=int, default=2048, help="Maximum download size (default: 2048 MiB).")
    parser.add_argument("--timeout", type=int, default=60, help="Per-request timeout in seconds.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    temp_path: Path | None = None
    try:
        source_page = validate_official_page_url(args.source_page)
        validate_download_url(args.url)
        slug = validate_slug(args.slug)
        if args.max_mb <= 0 or args.timeout <= 0:
            raise AssetWorkflowError("--max-mb and --timeout must be positive integers.")

        packs_root = resolve_path(args.packs_root)
        packs_root.mkdir(parents=True, exist_ok=True)
        pack_dir = packs_root / slug
        if pack_dir.is_symlink():
            raise AssetWorkflowError("Destination pack folder must not be a symlink.")
        pack_dir.mkdir(parents=True, exist_ok=True)
        if (pack_dir / ".kenney-download.json").exists() or (pack_dir / ".kenney-download.json").is_symlink():
            raise AssetWorkflowError(
                "This pack folder already has download metadata. Use a new slug or inspect it first."
            )

        descriptor, temp_name = tempfile.mkstemp(prefix=".kenney-download-", suffix=".zip", dir=pack_dir)
        os.close(descriptor)
        temp_path = Path(temp_name)
        size, digest, final_name = download(
            args.url, temp_path, args.max_mb * 1024**2, args.timeout
        )
        verify_zip_crc(temp_path)

        archive_path = pack_dir / final_name
        if archive_path.exists() or archive_path.is_symlink():
            raise AssetWorkflowError(
                f"Archive already exists at {archive_path}; it was left unchanged."
            )
        try:
            os.link(temp_path, archive_path)
            temp_path.unlink()
            temp_path = None
        except OSError:
            # Exclusive creation prevents replacing a file if hard links are unavailable.
            with archive_path.open("xb") as destination, temp_path.open("rb") as source:
                shutil.copyfileobj(source, destination)
            temp_path.unlink()
            temp_path = None

        metadata = {
            "schemaVersion": 1,
            "archiveName": archive_path.name,
            "archiveSha256": digest,
            "archiveSizeBytes": size,
            "sourcePage": source_page,
            "downloadedAt": datetime.now(timezone.utc).isoformat(),
        }
        sidecar = pack_dir / ".kenney-download.json"
        with sidecar.open("x", encoding="utf-8") as stream:
            json.dump(metadata, stream, indent=2, ensure_ascii=False)
            stream.write("\n")

        print(f"Downloaded and ZIP-verified: {archive_path}")
        print(f"SHA-256: {digest}")
        print(f"Source page: {source_page}")
        print("Next: run prepare_pack.py with this archive and the same slug.")
        return 0
    except (AssetWorkflowError, HTTPError, URLError, OSError) as exc:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
        if isinstance(exc, HTTPError):
            message = f"Download failed with HTTP status {exc.code}."
        elif isinstance(exc, URLError):
            message = "Could not reach the download server."
        else:
            message = str(exc)
        print(f"Error: {message}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
