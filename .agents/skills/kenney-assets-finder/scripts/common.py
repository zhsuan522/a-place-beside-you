"""Shared helpers for the project-local Kenney asset workflow."""

from __future__ import annotations

import hashlib
import re
import stat
import struct
import zipfile
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit, urlunsplit

PROJECT_ROOT = Path(__file__).resolve().parents[4]
DEFAULT_PACKS_ROOT = PROJECT_ROOT / "public" / "assets" / "packs" / "kenney"

OFFICIAL_PAGE_HOSTS = {"kenney.nl", "www.kenney.nl", "kenney-assets.itch.io"}
OFFICIAL_DOWNLOAD_HOSTS = OFFICIAL_PAGE_HOSTS
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class AssetWorkflowError(Exception):
    """A user-correctable issue in the asset workflow."""


def validate_slug(value: str) -> str:
    if not SLUG_PATTERN.fullmatch(value):
        raise AssetWorkflowError(
            "Pack slug must use lowercase letters, numbers, and single hyphens "
            "(for example: tiny-dungeon)."
        )
    return value


def _validate_https_url(value: str, label: str) -> tuple[str, str]:
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except ValueError as exc:
        raise AssetWorkflowError(f"Invalid {label}.") from exc

    host = (parsed.hostname or "").lower().rstrip(".")
    if (
        parsed.scheme.lower() != "https"
        or not host
        or parsed.username is not None
        or parsed.password is not None
        or port not in (None, 443)
    ):
        raise AssetWorkflowError(f"{label} must be an HTTPS URL without credentials.")
    return host, parsed.netloc


def validate_official_page_url(value: str) -> str:
    host, _ = _validate_https_url(value, "Source page")
    if host not in OFFICIAL_PAGE_HOSTS:
        raise AssetWorkflowError(
            "Source page must be on kenney.nl or Kenney's kenney-assets.itch.io account."
        )
    parsed = urlsplit(value)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def validate_download_url(value: str) -> str:
    host, _ = _validate_https_url(value, "Download URL")
    is_itch_cdn = host.endswith(".itch.zone")
    if host not in OFFICIAL_DOWNLOAD_HOSTS and not is_itch_cdn:
        raise AssetWorkflowError(
            "Download URL must be on kenney.nl, Kenney's itch.io account, "
            "or itch.io's download CDN."
        )
    return value


def resolve_path(value: str | Path, base: Path | None = None) -> Path:
    path = Path(value).expanduser()
    if not path.is_absolute():
        path = (base or Path.cwd()) / path
    return path.resolve()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inspect_zip(
    archive_path: Path,
    *,
    max_entries: int = 100_000,
    max_uncompressed_bytes: int = 20 * 1024**3,
    max_file_bytes: int = 5 * 1024**3,
    max_compression_ratio: int = 10_000,
) -> list[zipfile.ZipInfo]:
    """Validate ZIP structure and return its entries without extracting anything."""
    if archive_path.is_symlink() or not archive_path.is_file():
        raise AssetWorkflowError("Archive must be a regular, non-symlink file.")
    if archive_path.suffix.lower() != ".zip":
        raise AssetWorkflowError("Archive filename must end in .zip.")

    try:
        with zipfile.ZipFile(archive_path) as archive:
            entries = archive.infolist()
            if not entries:
                raise AssetWorkflowError("Archive is empty.")
            if len(entries) > max_entries:
                raise AssetWorkflowError(
                    f"Archive has too many entries ({len(entries)}; limit {max_entries})."
                )

            total_size = 0
            seen: dict[str, tuple[bool, str]] = {}
            for info in entries:
                name = info.filename
                if not name or "\x00" in name or "\\" in name:
                    raise AssetWorkflowError(f"Unsafe ZIP entry name: {name!r}.")
                path = PurePosixPath(name)
                if (
                    path.is_absolute()
                    or re.match(r"^[A-Za-z]:", name)
                    or any(part in ("", ".", "..") for part in path.parts)
                ):
                    raise AssetWorkflowError(f"Unsafe ZIP entry path: {name!r}.")

                is_dir = info.is_dir()
                mode = (info.external_attr >> 16) & 0xFFFF
                file_type = stat.S_IFMT(mode)
                if stat.S_ISLNK(mode):
                    raise AssetWorkflowError(f"ZIP contains a symlink: {name!r}.")
                if file_type not in (0, stat.S_IFREG, stat.S_IFDIR):
                    raise AssetWorkflowError(f"ZIP contains a special file: {name!r}.")
                if info.flag_bits & 0x1:
                    raise AssetWorkflowError(f"Encrypted ZIP entries are not supported: {name!r}.")
                if not is_dir:
                    if info.file_size > max_file_bytes:
                        raise AssetWorkflowError(f"ZIP entry is too large: {name!r}.")
                    total_size += info.file_size
                    if total_size > max_uncompressed_bytes:
                        raise AssetWorkflowError(
                            "Archive exceeds the allowed uncompressed size "
                            f"({max_uncompressed_bytes} bytes)."
                        )
                    if (
                        info.file_size > 10 * 1024**2
                        and info.file_size / max(info.compress_size, 1) > max_compression_ratio
                    ):
                        raise AssetWorkflowError(
                            f"ZIP entry has an unusually high compression ratio: {name!r}."
                        )

                normalized = path.as_posix().rstrip("/").casefold()
                if normalized in seen:
                    raise AssetWorkflowError(
                        f"ZIP contains duplicate or case-colliding paths: {name!r} "
                        f"and {seen[normalized][1]!r}."
                    )
                seen[normalized] = (is_dir, name)

            for info in entries:
                path = PurePosixPath(info.filename)
                for parent in path.parents:
                    if parent == PurePosixPath("."):
                        continue
                    parent_entry = seen.get(parent.as_posix().casefold())
                    if parent_entry and not parent_entry[0]:
                        raise AssetWorkflowError(
                            f"ZIP path conflicts with a file: {parent_entry[1]!r}."
                        )
            return entries
    except zipfile.BadZipFile as exc:
        raise AssetWorkflowError("File is not a readable ZIP archive.") from exc
    except OSError as exc:
        raise AssetWorkflowError(f"Could not read archive: {exc}") from exc


def verify_zip_crc(archive_path: Path) -> None:
    inspect_zip(archive_path)
    try:
        with zipfile.ZipFile(archive_path) as archive:
            bad_entry = archive.testzip()
    except (OSError, zipfile.BadZipFile) as exc:
        raise AssetWorkflowError("ZIP integrity check failed.") from exc
    if bad_entry is not None:
        raise AssetWorkflowError(f"ZIP CRC check failed for {bad_entry!r}.")


def image_dimensions(path: Path) -> tuple[int, int] | None:
    """Read dimensions for common formats without adding image-library dependencies."""
    try:
        with path.open("rb") as stream:
            header = stream.read(32)
            if header.startswith(b"\x89PNG\r\n\x1a\n") and len(header) >= 24:
                return struct.unpack(">II", header[16:24])
            if header[:6] in (b"GIF87a", b"GIF89a") and len(header) >= 10:
                return struct.unpack("<HH", header[6:10])
            if header[:2] == b"BM" and len(header) >= 26:
                width, height = struct.unpack("<ii", header[18:26])
                return abs(width), abs(height)
            if header[:2] == b"\xff\xd8":
                stream.seek(2)
                sof_markers = {
                    0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                    0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
                }
                while True:
                    byte = stream.read(1)
                    if not byte:
                        return None
                    if byte != b"\xff":
                        continue
                    marker_byte = stream.read(1)
                    while marker_byte == b"\xff":
                        marker_byte = stream.read(1)
                    if not marker_byte:
                        return None
                    marker = marker_byte[0]
                    if marker in (0xD8, 0xD9, 0x01) or 0xD0 <= marker <= 0xD7:
                        continue
                    length_bytes = stream.read(2)
                    if len(length_bytes) != 2:
                        return None
                    length = struct.unpack(">H", length_bytes)[0]
                    if length < 2:
                        return None
                    if marker in sof_markers:
                        data = stream.read(5)
                        if len(data) != 5:
                            return None
                        height, width = struct.unpack(">HH", data[1:5])
                        return width, height
                    stream.seek(length - 2, 1)
    except (OSError, struct.error):
        return None
    return None
