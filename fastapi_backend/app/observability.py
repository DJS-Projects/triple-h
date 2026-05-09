"""OpenTelemetry tracing + GrowthBook feature flag bootstrap.

Centralizes the third-party observability wiring so `main.py` stays
focused on FastAPI assembly. Both subsystems are gated by `Settings`
flags and degrade gracefully when their backends aren't reachable —
the backend boots and serves traffic regardless of whether Langfuse,
GrowthBook, or an OTel collector are up.

OpenTelemetry contract:
  - `init_otel(app)` is idempotent — uvicorn --reload calls main.py
    twice, so we guard with a module-level flag.
  - When `OTEL_EXPORTER_OTLP_ENDPOINT` is unset, spans go to the
    console (stdout → docker logs) — useful for local dev without
    standing up a collector.
  - Auto-instrumentation covers the three boundary surfaces that
    matter: HTTP requests in (FastAPI), HTTP requests out (httpx —
    every Chandra REST + LiteLLM proxy call), and database queries
    (asyncpg). Manual spans inside the extraction pipeline annotate
    the higher-level stages (chandra ocr, page render, llm call).

GrowthBook contract:
  - `init_growthbook()` returns a client when both API_HOST and
    CLIENT_KEY are configured; otherwise None.
  - `get_growthbook()` is the read-side accessor — every flag check
    must tolerate `None` and fall back to a safe default. This means
    the entire observability stack going down doesn't break the app.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import (
    BatchSpanProcessor,
    ConsoleSpanExporter,
    SpanExporter,
)

from app.config import settings

if TYPE_CHECKING:
    from fastapi import FastAPI
    from growthbook import GrowthBook

_log = logging.getLogger(__name__)

# Idempotency guards. uvicorn --reload re-imports main.py on file
# changes; double-instrumenting raises errors from the OTel API and
# double-booting GrowthBook leaks a thread.
_otel_initialized = False
_growthbook_client: GrowthBook | None = None
_growthbook_initialized = False


# ─── OpenTelemetry ──────────────────────────────────────────────────────────


def _build_exporter() -> SpanExporter:
    """OTLP/gRPC when an endpoint is configured, console otherwise."""
    endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT
    if endpoint:
        _log.info("OTel: exporting spans to OTLP endpoint %s", endpoint)
        return OTLPSpanExporter(endpoint=endpoint)
    _log.info("OTel: no OTLP endpoint set — spans render to console (stdout)")
    return ConsoleSpanExporter()


def init_otel(app: FastAPI) -> None:
    """Bootstrap the OpenTelemetry SDK and auto-instrument the boundaries.

    Must run BEFORE the first request is served. uvicorn --reload
    triggers a re-import of main.py on file changes — the
    `_otel_initialized` guard makes this safe.

    Skipped under pytest: the ConsoleSpanExporter writes to stdout,
    which pytest's capture machinery rotates between tests — async
    BatchSpanProcessor flushes then crash with "I/O operation on
    closed file". Tests get no traces (and don't need them).
    """
    import sys

    global _otel_initialized
    if "pytest" in sys.modules:
        return
    if not settings.OTEL_ENABLED:
        _log.info("OTel: disabled via OTEL_ENABLED=false")
        return
    if _otel_initialized:
        return

    resource = Resource.create({"service.name": settings.OTEL_SERVICE_NAME})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(_build_exporter()))
    trace.set_tracer_provider(provider)

    # Order matters: instrument the FastAPI app *after* setting the
    # provider so the instrumentor picks up our exporter chain.
    FastAPIInstrumentor.instrument_app(app)
    HTTPXClientInstrumentor().instrument()
    # AsyncPGInstrumentor lacks a typed stub for instrument() in the
    # local venv but pre-commit's mypy sees it as Any (no instrumentor
    # package installed in the hook env). The double-code ignore
    # covers both — silence in local strict, no "unused ignore" in CI.
    AsyncPGInstrumentor().instrument()  # type: ignore[no-untyped-call,unused-ignore]

    _otel_initialized = True
    _log.info("OTel: initialized (service=%s)", settings.OTEL_SERVICE_NAME)


# ─── GrowthBook ─────────────────────────────────────────────────────────────


def init_growthbook() -> None:
    """Build a GrowthBook client if both API_HOST and CLIENT_KEY are set.

    Lazy: callers reach the client via `get_growthbook()`, which
    returns None when the SDK couldn't be initialized. Every flag
    check must therefore tolerate `None` and fall back to a safe
    default.
    """
    global _growthbook_client, _growthbook_initialized
    if _growthbook_initialized:
        return
    _growthbook_initialized = True  # set early so retries don't spin

    if not settings.GROWTHBOOK_API_HOST or not settings.GROWTHBOOK_CLIENT_KEY:
        _log.info(
            "GrowthBook: not configured (set GROWTHBOOK_API_HOST + "
            "GROWTHBOOK_CLIENT_KEY to enable)"
        )
        return

    try:
        from growthbook import GrowthBook

        _growthbook_client = GrowthBook(
            api_host=settings.GROWTHBOOK_API_HOST,
            client_key=settings.GROWTHBOOK_CLIENT_KEY,
        )
        _growthbook_client.load_features()
        _log.info("GrowthBook: initialized (host=%s)", settings.GROWTHBOOK_API_HOST)
    except Exception as exc:  # noqa: BLE001 — never let observability crash the app
        _log.warning(
            "GrowthBook: initialization failed (%s) — flags will use defaults", exc
        )
        _growthbook_client = None


def get_growthbook() -> GrowthBook | None:
    """Accessor — returns None when the SDK isn't configured or failed to boot."""
    return _growthbook_client


def is_feature_on(flag_key: str, *, default: bool = False) -> bool:
    """Read a boolean feature flag, with a safe default for the no-client path.

    `default` is the value used when:
      - GrowthBook isn't configured (no API_HOST / CLIENT_KEY)
      - the flag doesn't exist in the GrowthBook project
      - the SDK call raises (network error, etc.)

    Pick `default` so the safer code path runs when observability is
    down — e.g. for "use new ARQ pipeline?" the default should be
    False (legacy single-pass) so a flag-server outage doesn't
    silently route traffic through unproven code.
    """
    client = get_growthbook()
    if client is None:
        return default
    try:
        return bool(client.is_on(flag_key))
    except Exception as exc:  # noqa: BLE001 — observability must not break the app
        _log.warning(
            "GrowthBook: is_on(%r) failed (%s) — falling back to default %r",
            flag_key,
            exc,
            default,
        )
        return default
