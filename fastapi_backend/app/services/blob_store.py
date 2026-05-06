"""Blob storage abstraction.

Today: `LocalDiskStore` writes to a host-mounted volume (`/data/blobs`).
Tomorrow: `S3Store` / `GCSStore` / `RustFSStore` slot in behind the same
`BlobStore` Protocol. Keys are bytewise-portable across backends:
`sync` from local to S3 keeps the same key layout.

Key conventions
---------------
- Document PDFs: `documents/<sha256[:2]>/<sha256>.pdf`
- Page PNGs:    `pages/<document_id>/<page_no:03d>.png`

The two-char shard prefix (`<sha256[:2]>`) spreads files across 256 dirs,
which keeps ext4 fast and matches how object stores partition prefixes.
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Protocol, runtime_checkable

import aiofiles
import aiofiles.os

from app.config import settings


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def document_key(sha256: str, *, suffix: str = ".pdf") -> str:
    return f"documents/{sha256[:2]}/{sha256}{suffix}"


def page_key(document_id: str, page_no: int) -> str:
    return f"pages/{document_id}/{page_no:03d}.png"


@runtime_checkable
class BlobStore(Protocol):
    """Storage backend interface. All paths/keys are forward-slash separated."""

    async def put(self, key: str, data: bytes, *, content_type: str) -> str:
        """Write `data` at `key`. Returns the stored key."""
        ...

    async def get(self, key: str) -> bytes:
        """Read the full blob at `key`. Raises FileNotFoundError if missing."""
        ...

    async def exists(self, key: str) -> bool: ...

    async def delete(self, key: str) -> None: ...

    async def url(self, key: str, *, ttl_seconds: int = 3600) -> str:
        """Return a URL for the client. Local backend returns an internal
        FastAPI route path; cloud backends return presigned URLs."""
        ...


class LocalDiskStore:
    """File-system backed BlobStore. Used in dev + single-node prod."""

    def __init__(self, root: str | Path) -> None:
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        # Forbid escape via `..` — a key is treated as a relative path.
        if ".." in Path(key).parts:
            raise ValueError(f"invalid blob key: {key!r}")
        return self._root / key

    async def put(self, key: str, data: bytes, *, content_type: str) -> str:
        path = self._path(key)
        await aiofiles.os.makedirs(path.parent, exist_ok=True)
        async with aiofiles.open(path, "wb") as fh:
            await fh.write(data)
        return key

    async def get(self, key: str) -> bytes:
        path = self._path(key)
        async with aiofiles.open(path, "rb") as fh:
            return await fh.read()

    async def exists(self, key: str) -> bool:
        return await aiofiles.os.path.exists(self._path(key))

    async def delete(self, key: str) -> None:
        path = self._path(key)
        try:
            await aiofiles.os.remove(path)
        except FileNotFoundError:
            return

    async def url(self, key: str, *, ttl_seconds: int = 3600) -> str:
        # Local backend has no signed URLs; FastAPI serves blobs via
        # /documents/{id}/pages/{n}.png and equivalent download routes.
        return f"blob://{key}"

    @property
    def root(self) -> Path:
        return self._root


_singleton: BlobStore | None = None


def get_blob_store() -> BlobStore:
    """Return the configured BlobStore. One instance per process."""
    global _singleton
    if _singleton is not None:
        return _singleton
    backend = settings.BLOB_BACKEND.lower()
    if backend == "local":
        _singleton = LocalDiskStore(settings.BLOB_LOCAL_PATH)
        return _singleton
    raise NotImplementedError(
        f"BLOB_BACKEND={backend!r} not implemented yet (planned: s3, gcs, rustfs)"
    )
