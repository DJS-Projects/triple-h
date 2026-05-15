"""Interactive first-time setup. Driven by `mise setup`.

What this orchestrates, in order:

  1. Backend dependency install   (uv sync)
  2. Frontend dependency install  (bun install)
  3. .env.keys presence + perms   (must exist, chmod 600)
  4. .env files decrypt-check     (sanity: keys file can decrypt .env)
  5. Pre-commit git hooks
  6. Docker availability sanity
  7. Print next-steps cheat sheet

Idempotent — safe to re-run any time. Each step is its own function, so
fixing a flaky step doesn't require redoing the others.

Stdlib only. Cross-platform-safe enough (Linux/macOS primary; Windows
gets best-effort guidance).
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
_ENV_KEYS = _REPO_ROOT / ".env.keys"
_BE_ENV = _REPO_ROOT / "fastapi_backend" / ".env"
_FE_ENV = _REPO_ROOT / "nextjs-frontend" / ".env"


# ─── Tiny formatting helpers (no rich/colorama dep) ────────────────────────

_ANSI = {
    "reset": "\033[0m",
    "bold": "\033[1m",
    "dim": "\033[2m",
    "green": "\033[32m",
    "yellow": "\033[33m",
    "red": "\033[31m",
    "blue": "\033[34m",
    "cyan": "\033[36m",
}


def _color(text: str, *codes: str) -> str:
    if not sys.stdout.isatty():
        return text
    prefix = "".join(_ANSI[c] for c in codes)
    return f"{prefix}{text}{_ANSI['reset']}"


def _header(step: int, total: int, title: str) -> None:
    bar = _color(f"━━━ [{step}/{total}] {title} ", "bold", "cyan")
    print(f"\n{bar}")


def _ok(msg: str) -> None:
    print(f"  {_color('✓', 'green')} {msg}")


def _warn(msg: str) -> None:
    print(f"  {_color('⚠', 'yellow')} {msg}")


def _err(msg: str) -> None:
    print(f"  {_color('✗', 'red')} {msg}")


def _info(msg: str) -> None:
    print(f"  {_color('•', 'dim')} {msg}")


def _prompt_yes(question: str, *, default: bool = True) -> bool:
    suffix = "[Y/n]" if default else "[y/N]"
    while True:
        raw = input(f"  {question} {suffix} ").strip().lower()
        if not raw:
            return default
        if raw in ("y", "yes"):
            return True
        if raw in ("n", "no"):
            return False
        print("  (please answer y or n)")


# ─── Step 1+2: dependency installs ────────────────────────────────────────


def _run(cmd: list[str], cwd: Path | None = None) -> int:
    """Run a subprocess, stream output, return exit code."""
    try:
        return subprocess.call(cmd, cwd=cwd)
    except FileNotFoundError:
        _err(f"command not found: {cmd[0]}")
        return 127


def install_backend() -> bool:
    if shutil.which("uv") is None:
        _err(
            "`uv` not found on PATH. Install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
        )
        return False
    _info("running: uv sync")
    rc = _run(["uv", "sync"], cwd=_REPO_ROOT / "fastapi_backend")
    if rc != 0:
        _err(f"backend install failed (exit {rc})")
        return False
    _ok("backend deps installed")
    return True


def install_frontend() -> bool:
    if shutil.which("bun") is None:
        _err(
            "`bun` not found on PATH. Install with: curl -fsSL https://bun.sh/install | bash"
        )
        return False
    _info("running: bun install")
    rc = _run(["bun", "install"], cwd=_REPO_ROOT / "nextjs-frontend")
    if rc != 0:
        _err(f"frontend install failed (exit {rc})")
        return False
    _ok("frontend deps installed")
    return True


# ─── Step 3: .env.keys presence + perms ──────────────────────────────────


def ensure_env_keys() -> bool:
    """Verify .env.keys exists; if missing, walk the user through getting it.

    If present, enforce 600 perms (idempotent — re-chmods every run).
    """
    if not _ENV_KEYS.exists():
        _warn(".env.keys is missing — required for decrypting the encrypted .env files")
        print()
        print(
            f"  This file holds the dotenvx master key. {_color('NEVER commit it.', 'bold', 'red')}"
        )
        print(
            f"  Ask the project maintainer (Darren) for the current {_color('.env.keys', 'cyan')} and"
        )
        print(f"  paste it into: {_color(str(_ENV_KEYS), 'cyan')}")
        print()
        print(f"  Once it's in place, re-run: {_color('mise setup', 'bold')}")
        return False

    # Lock perms to owner-only. dotenvx + SSH-key convention: 600.
    current_mode = _ENV_KEYS.stat().st_mode & 0o777
    if current_mode != 0o600:
        _ENV_KEYS.chmod(0o600)
        _warn(
            f".env.keys had mode {oct(current_mode)[2:]} — tightened to 600 (owner-only)"
        )
    else:
        _ok(".env.keys present + mode 600")
    return True


# ─── Step 4: decrypt sanity (does the key actually work?) ────────────────


def verify_decrypt() -> bool:
    """Sanity-check: can dotenvx decrypt each .env file with the current key?

    Catches the failure mode where someone got an OLD .env.keys for a
    rotated .env — encrypted file exists, key file exists, but they
    don't match. Uses `dotenvx run -- true`: spawns a no-op command
    inside the decrypted env. Exit 0 = decryption succeeded.
    """
    if shutil.which("dotenvx") is None:
        _warn("`dotenvx` not on PATH; skipping decrypt check")
        _info("install with: curl -fsS https://dotenvx.sh/install.sh | sh")
        return True  # not fatal — encrypt/decrypt can be added later

    for label, env_file in (("backend", _BE_ENV), ("frontend", _FE_ENV)):
        if not env_file.exists():
            _info(f"{label} .env not present (skipping check)")
            continue
        result = subprocess.run(
            [
                "dotenvx",
                "run",
                "-fk",
                str(_ENV_KEYS),
                "-f",
                str(env_file),
                "--quiet",
                "--",
                "true",
            ],
            capture_output=True,
        )
        if result.returncode != 0:
            err_preview = result.stderr.decode("utf-8", errors="replace")[:200].strip()
            _warn(
                f"{label} .env decrypt failed — possible key mismatch.\n"
                f"     {err_preview}"
            )
        else:
            _ok(f"{label} .env decrypts cleanly")
    return True


# ─── Step 5: pre-commit hooks ────────────────────────────────────────────


def install_pre_commit() -> bool:
    if shutil.which("pre-commit") is None:
        _warn("`pre-commit` not found on PATH")
        _info("install with: uv tool install pre-commit  (or: pipx install pre-commit)")
        return False
    result = subprocess.run(
        ["pre-commit", "install"], cwd=_REPO_ROOT, capture_output=True
    )
    if result.returncode != 0:
        # pre-commit writes errors to stdout (yes, really), not stderr.
        # Check both to be safe.
        out = result.stdout.decode("utf-8", errors="replace")
        err = result.stderr.decode("utf-8", errors="replace")
        combined = out + err
        # Common: a global `core.hooksPath` (often set by dotfile managers
        # like Omarchy or husky-style global hooks) makes pre-commit refuse
        # to install — it won't shadow your existing hooks dir silently.
        # Give a one-line fix instead of dumping the raw text.
        if "core.hooksPath" in combined:
            _warn(
                "pre-commit refuses to install — git has a global "
                "`core.hooksPath` set, which would shadow the repo hooks"
            )
            _info("fix with one of:")
            _info("  git config --unset-all core.hooksPath        # remove globally")
            _info("  git config --local core.hooksPath .git/hooks # override per-repo")
            _info("then re-run: mise setup:hooks")
            return False
        _err(f"pre-commit install failed (exit {result.returncode})")
        _info(combined.strip()[:200])
        return False
    _ok("pre-commit hooks installed")
    return True


# ─── Step 6: docker sanity ──────────────────────────────────────────────


def check_docker() -> bool:
    if shutil.which("docker") is None:
        _err("docker CLI not found on PATH — required for `mise docker:up`")
        return False
    # `docker info` is heavier but tells us if the daemon is actually reachable.
    result = subprocess.run(["docker", "info"], capture_output=True, timeout=10)
    if result.returncode != 0:
        _warn(
            "docker installed but daemon not reachable (start Docker Desktop / systemd unit)"
        )
        return False
    _ok("docker daemon reachable")
    return True


# ─── Step 7: next-steps cheat sheet ──────────────────────────────────────


def print_next_steps() -> None:
    print()
    print(_color("━" * 72, "dim"))
    print(_color(" You're set. Next steps:", "bold", "green"))
    print(_color("━" * 72, "dim"))
    print()
    print(f"  1. {_color('mise docker:up', 'bold', 'cyan')}")
    print(
        "     Start full stack (backend, worker, frontend, langfuse, growthbook, litellm)."
    )
    print()
    print(f"  2. {_color('Langfuse bootstrap', 'bold')} (one-time, see CLAUDE.md)")
    print("     • open http://localhost:3001 → sign up → create project")
    print("     • Settings → API Keys → create new → copy both keys")
    print(
        f"     • {_color('mise env:addkey', 'cyan')} × 2 (LANGFUSE_PUBLIC_KEY then LANGFUSE_SECRET_KEY)"
    )
    print(f"     • {_color('mise docker:up', 'cyan')}  (litellm picks up the new keys)")
    print()
    print(f"  3. {_color('GrowthBook bootstrap', 'bold')} (one-time)")
    print("     • open http://localhost:3031 → create project → copy SDK key")
    print(f"     • {_color('mise env:addkey', 'cyan')} (GROWTHBOOK_CLIENT_KEY)")
    print(
        f"     • add feature flag {_color('use_arq_pipeline', 'cyan')} (boolean, default false)"
    )
    print()
    print("  Daily dev loop:")
    print(f"     {_color('mise docker:watch', 'cyan')}    # hot-reload watch mode")
    print(f"     {_color('mise be:test', 'cyan')}        # backend tests")
    print(f"     {_color('mise be:lint', 'cyan')}        # ruff + mypy")
    print()


# ─── Orchestrator ────────────────────────────────────────────────────────


def main() -> int:
    print(_color("\n  triple-h interactive setup", "bold"))
    print(_color("  ──────────────────────────", "dim"))

    steps_total = 6
    failures: list[str] = []

    _header(1, steps_total, "Backend dependencies")
    if not install_backend():
        failures.append("backend deps")

    _header(2, steps_total, "Frontend dependencies")
    if not install_frontend():
        failures.append("frontend deps")

    _header(3, steps_total, ".env.keys (encrypted-env master key)")
    if not ensure_env_keys():
        failures.append(".env.keys")
        # No point continuing if the key is missing — print cheat sheet and exit.
        print()
        _err("Setup stopped: place .env.keys then re-run `mise setup`.")
        return 1

    _header(4, steps_total, "Decrypt-check encrypted .env files")
    verify_decrypt()  # non-fatal warnings only

    _header(5, steps_total, "Pre-commit hooks")
    if not install_pre_commit():
        failures.append("pre-commit (non-fatal — install when ready)")

    _header(6, steps_total, "Docker availability")
    if not check_docker():
        failures.append("docker (required before `mise docker:up`)")

    if failures:
        print()
        _warn(f"Setup completed with {len(failures)} issue(s):")
        for f in failures:
            print(f"     - {f}")
        print()
        _info("Fix the issues above, then re-run `mise setup`. Otherwise:")

    print_next_steps()
    return 0 if not failures else 0  # always 0 — failures are advisory


if __name__ == "__main__":
    raise SystemExit(main())
