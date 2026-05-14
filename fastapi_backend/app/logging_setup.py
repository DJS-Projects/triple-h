"""Structured logging setup — structlog bridged to stdlib + OTel.

Every `logger.info("event_name", **fields)` call lands as:

  1. A stdlib LogRecord (captured by uvicorn + the OTel LoggingHandler
     wired in `observability.py` for OTLP export to the collector).
  2. JSON on stdout (for local `docker compose logs` inspection).

Two custom processors inject context that the user actually wants in
the trace UI:

  - `_trace_context_processor` reads the currently-active OTel span (if
    any) and adds `trace_id` + `span_id`. Logs emitted inside a span
    show up alongside that span in Jaeger/Tempo without any explicit
    correlation glue.

  - `_extraction_context_processor` reads the ContextVars that
    `TimingMiddleware` sets at request start (`extraction_id`,
    `request_start_perf`) and adds `extraction_id` + `T+elapsed`.
    Lets a reviewer follow one extraction end-to-end across every
    pipeline stage, anchor match, and ARQ slot.

Usage:

    from app.logging_setup import get_logger
    logger = get_logger(__name__)

    logger.info("anchor_match", field="vehicle_number", value="JWP8186", ...)

Re-entry safe — `configure_logging()` is idempotent and tolerates
uvicorn --reload re-importing main.py.
"""

from __future__ import annotations

import logging
import time
from collections.abc import MutableMapping
from contextvars import ContextVar
from typing import Any, cast

import structlog
from opentelemetry import trace

# ─── Per-request ContextVars (set by TimingMiddleware) ──────────────────────
#
# Module-level so processors can `.get()` cheaply. Defaults are None so
# logs emitted outside an HTTP request (startup, background tasks) just
# don't carry these fields rather than crashing.

extraction_id_var: ContextVar[str | None] = ContextVar(
    "extraction_id_var", default=None
)
request_start_var: ContextVar[float | None] = ContextVar(
    "request_start_var", default=None
)


# ─── Custom processors ──────────────────────────────────────────────────────


def _trace_context_processor(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """Inject OTel trace_id + span_id from the active span, if any.

    Hex-encoded so the values match what Jaeger/Tempo show in their UI.
    OTel int IDs are awkward to grep for; the hex form is what shows up
    in URLs and queries.
    """
    span = trace.get_current_span()
    ctx = span.get_span_context() if span else None
    if ctx is not None and ctx.is_valid:
        event_dict["trace_id"] = format(ctx.trace_id, "032x")
        event_dict["span_id"] = format(ctx.span_id, "016x")
    return event_dict


def _extraction_context_processor(
    _logger: Any, _method_name: str, event_dict: MutableMapping[str, Any]
) -> MutableMapping[str, Any]:
    """Inject extraction_id + T+elapsed from per-request ContextVars."""
    extraction_id = extraction_id_var.get()
    if extraction_id is not None:
        event_dict["extraction_id"] = extraction_id
    request_start = request_start_var.get()
    if request_start is not None:
        event_dict["t_elapsed_ms"] = round(
            (time.perf_counter() - request_start) * 1000, 2
        )
    return event_dict


# ─── Public API ─────────────────────────────────────────────────────────────


_configured = False


def configure_logging(*, json_output: bool = False) -> None:
    """Wire structlog to stdlib logging once.

    `json_output=True` for production / docker (machine-parseable),
    `json_output=False` (default) for local dev (colorized
    ConsoleRenderer). The OTel `LoggingHandler` from observability.py
    sees the structured event_dict either way — it pulls fields out
    of the LogRecord's `extra`/`msg`, not the rendered string.
    """
    global _configured
    if _configured:
        return

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        _trace_context_processor,
        _extraction_context_processor,
    ]

    renderer: structlog.types.Processor
    if json_output:
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=False)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Bridge: stdlib LogRecords from third-party libs (uvicorn, sqlalchemy,
    # httpx) flow through ProcessorFormatter so they get the same trace
    # context injection structlog calls do.
    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    root = logging.getLogger()
    # Replace the default StreamHandler (uvicorn installs its own; ours
    # adds the structured pipeline on top without removing what's there).
    handler = logging.StreamHandler()
    handler.setFormatter(formatter)
    root.addHandler(handler)
    root.setLevel(logging.INFO)

    _configured = True


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Return a configured structlog logger.

    `name` is the standard `__name__` convention. Bound logger means
    `logger.info("event", key=value)` produces structured output —
    don't use `%` formatting.
    """
    return cast(structlog.stdlib.BoundLogger, structlog.get_logger(name))
