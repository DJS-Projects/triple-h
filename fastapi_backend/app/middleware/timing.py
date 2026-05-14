import logging
import time
import uuid

from opentelemetry import trace
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.logging_setup import extraction_id_var, request_start_var

logger = logging.getLogger("triple_h.timing")


class TimingMiddleware:
    """Pure ASGI middleware. Records wall-clock duration per HTTP request.

    Three jobs per request:

      1. Emit a Server-Timing response header + one log line.
      2. Set per-request ContextVars (extraction_id, request_start_perf)
         so structlog's _extraction_context_processor can attach them
         to every log event fired inside this request.
      3. Surface the active OTel trace_id as an `X-Trace-Id` response
         header so devs can paste it into Jaeger/Tempo/Langfuse to
         find the trace without grepping logs.

    Skips lifespan and websocket scopes.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start = time.perf_counter()
        status_code = 0
        extraction_id = uuid.uuid4().hex[:12]

        # Set ContextVars FIRST so anything that fires during request
        # handling (route, services, OCR, LLM call) sees them. The
        # `reset(token)` in finally guarantees they don't leak across
        # requests handled by the same worker.
        extraction_token = extraction_id_var.set(extraction_id)
        start_token = request_start_var.set(start)

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                duration_ms = (time.perf_counter() - start) * 1000
                headers = list(message.get("headers", []))
                headers.append(
                    (b"server-timing", f"app;dur={duration_ms:.2f}".encode())
                )
                headers.append((b"x-extraction-id", extraction_id.encode()))
                # Surface the trace_id when an OTel span is active.
                # FastAPI's auto-instrumentation creates a request-root
                # span before this middleware runs, so the lookup is
                # cheap and reliable.
                span = trace.get_current_span()
                ctx = span.get_span_context() if span else None
                if ctx is not None and ctx.is_valid:
                    trace_id_hex = format(ctx.trace_id, "032x")
                    headers.append((b"x-trace-id", trace_id_hex.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            # Starlette's ServerErrorMiddleware is always outermost — it will
            # catch this and emit the 500 response *after* we re-raise. Without
            # this branch we'd log status=0 because send_wrapper never fires
            # on the exception path. HTTPException doesn't reach here (caught
            # by ExceptionMiddleware which sits inside us).
            status_code = 500
            raise
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            method = scope.get("method", "?")
            path = scope.get("path", "?")
            logger.info(
                "%s %s -> %d in %.2fms",
                method,
                path,
                status_code,
                duration_ms,
            )
            extraction_id_var.reset(extraction_token)
            request_start_var.reset(start_token)
