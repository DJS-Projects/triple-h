"""Interactive: encrypt a single env var into one of the .env files.

Driven by `mise run env:addkey`. Run from your own terminal — do NOT
pipe through an agent's Bash tool, as the silent paste relies on a
real TTY (getpass.getpass).

Caveat: the value is briefly visible in `ps` while dotenvx is running
(it takes the value as a CLI arg — no stdin flag exists). Acceptable
on a single-user dev machine; not safe on shared hosts.

Stdlib only — no third-party deps. Avoids the chmod + shebang dance
of a shell script while keeping the same security properties as the
prior bash version.
"""

from __future__ import annotations

import getpass
import subprocess
import sys
from pathlib import Path

# Repo-root-relative paths. Resolved against the script's own location
# so `mise run env:addkey` works regardless of the caller's cwd.
_REPO_ROOT = Path(__file__).resolve().parent.parent
_TARGETS = {
    "be": _REPO_ROOT / "fastapi_backend" / ".env",
    "fe": _REPO_ROOT / "nextjs-frontend" / ".env",
}
_ENV_KEYS = _REPO_ROOT / ".env.keys"


def _die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    sys.exit(code)


def main() -> None:
    # Refuse to run without a real TTY. Common cause of silent failure
    # is invocation through an agent's Bash tool or a pipe — getpass
    # would either fall back to echoed input (defeating the purpose)
    # or raise GetPassWarning. Better to bail loudly.
    if not sys.stdin.isatty():
        _die(
            "env:addkey needs an interactive terminal.\n"
            "Run it in your own shell, not through an agent's Bash tool or a pipe."
        )

    if not _ENV_KEYS.exists():
        _die(f"missing {_ENV_KEYS} — run `mise env:decrypt` setup first")

    # Target file
    target = input("Target (be|fe) [be]: ").strip() or "be"
    if target not in _TARGETS:
        _die(f"invalid target {target!r}, expected one of {sorted(_TARGETS)}")
    envfile = _TARGETS[target]

    # Variable name (not secret — names appear in plaintext in encrypted files)
    keyname = input("Variable name (e.g. OPENAI_API_KEY): ").strip()
    if not keyname:
        _die("variable name required")

    # Silent paste — getpass uses termios to disable echo when on a TTY.
    value = getpass.getpass("Paste value (input hidden, ENTER when done): ")
    if not value:
        _die("value required")

    # dotenvx encrypts via the public key in .env.keys. Suppress stdout
    # (does not contain plaintext but paranoia is cheap); errors still
    # surface via stderr + non-zero exit.
    result = subprocess.run(
        [
            "dotenvx",
            "set",
            keyname,
            value,
            "-f",
            str(envfile),
            "-fk",
            str(_ENV_KEYS),
        ],
        stdout=subprocess.DEVNULL,
        stderr=sys.stderr,
        check=False,
    )
    # Drop the reference; gc + secure-string isn't a thing in CPython
    # but un-binding limits accidental re-exposure if exception fires.
    del value
    if result.returncode != 0:
        _die(f"dotenvx failed (exit {result.returncode})", code=result.returncode)

    print(f"Encrypted {keyname} into {envfile.relative_to(_REPO_ROOT)}")


if __name__ == "__main__":
    main()
