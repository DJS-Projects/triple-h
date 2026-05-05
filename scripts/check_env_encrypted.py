#!/usr/bin/env python3
"""Fail commit when any .env file in repo contains plaintext secret values.

Auto-discovers .env files across the repo, skipping example/key/local variants
and common dependency directories. Each discovered file is checked for the
dotenvx `encrypted:` value prefix.
"""

import re
import sys
from pathlib import Path

ALLOWED_PLAINTEXT_KEYS = {"DOTENV_PUBLIC_KEY"}

SKIP_FILENAMES = {
    ".env.keys",
    ".env.local",
    ".env.example",
    ".env.sample",
    ".env.template",
    ".env.vault",
}

SKIP_DIRS = {
    "node_modules",
    ".venv",
    "venv",
    ".next",
    ".git",
    "dist",
    "build",
    "__pycache__",
    ".turbo",
    ".cache",
}

ENV_PATTERN = re.compile(r"^\.env(\..+)?$")
LINE_PATTERN = re.compile(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


def is_encrypted_value(raw_value: str) -> bool:
    value = raw_value.strip()
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        value = value[1:-1]
    return value.startswith("encrypted:")


def discover_env_files(root: Path) -> list[Path]:
    found: list[Path] = []
    for path in root.rglob(".env*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_FILENAMES:
            continue
        if not ENV_PATTERN.match(path.name):
            continue
        found.append(path)
    return sorted(found)


def check_file(env_file: Path, root: Path) -> bool:
    rel = env_file.relative_to(root)
    plaintext_keys: list[str] = []
    encrypted_count = 0

    for raw_line in env_file.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        match = LINE_PATTERN.match(line)
        if not match:
            continue

        key, raw_value = match.groups()
        if key in ALLOWED_PLAINTEXT_KEYS:
            continue

        if is_encrypted_value(raw_value):
            encrypted_count += 1
        else:
            plaintext_keys.append(key)

    if encrypted_count == 0 and not plaintext_keys:
        print(f"   {rel}: empty (skip)")
        return True

    if encrypted_count > 0 and not plaintext_keys:
        print(f"🔒 {rel}: encrypted")
        return True

    print(f"⚠️  {rel}: plaintext values found")
    preview = ", ".join(plaintext_keys[:6])
    suffix = " ..." if len(plaintext_keys) > 6 else ""
    print(f"   keys: {preview}{suffix}")
    return False


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    env_files = discover_env_files(root)

    if not env_files:
        print("No .env files found")
        return 0

    print(f"Checking {len(env_files)} .env file(s)...")
    results = [check_file(f, root) for f in env_files]

    if all(results):
        return 0

    print("\n   Run 'mise run env:encrypt' before commit")
    return 1


if __name__ == "__main__":
    sys.exit(main())
