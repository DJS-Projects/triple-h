"""Check that all .env values are encrypted (start with 'encrypted:').

Usage: python scripts/check_env_encrypted.py .env .env.production
"""

import sys

SKIP_KEYS = {"DOTENV_PUBLIC_KEY"}


def check_file(path: str) -> list[str]:
    errors = []
    try:
        with open(path) as f:
            lines = f.readlines()
    except FileNotFoundError:
        return []

    for num, raw in enumerate(lines, 1):
        line = raw.strip()

        if not line or line.startswith("#"):
            continue

        if "=" not in line:
            continue

        key, _, value = line.partition("=")
        key = key.strip()

        if key in SKIP_KEYS:
            continue

        value = value.strip().strip("\"'")

        if not value:
            continue

        if not value.startswith("encrypted:"):
            errors.append(f"  {path}:{num} — {key} is not encrypted")

    return errors


def main() -> int:
    files = sys.argv[1:]
    if not files:
        print("No .env files to check")
        return 0

    all_errors: list[str] = []
    for f in files:
        all_errors.extend(check_file(f))

    if all_errors:
        print("Unencrypted env values found:\n")
        print("\n".join(all_errors))
        print("\nRun 'dotenvx encrypt' before committing.")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
