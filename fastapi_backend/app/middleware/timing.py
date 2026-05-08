import logging
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("triple_h.timing")


class TimingMiddleware:
    """Pure ASGI middleware. Records wall-clock duration per HTTP request.

    Emits a Server-Timing response header and a single log line per request.
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

        async def send_wrapper(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                duration_ms = (time.perf_counter() - start) * 1000
                headers = list(message.get("headers", []))
                headers.append(
                    (b"server-timing", f"app;dur={duration_ms:.2f}".encode())
                )
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
