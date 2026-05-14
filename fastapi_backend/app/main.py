import logging

from fastapi import FastAPI
from fastapi_pagination import add_pagination
from .schemas import UserCreate, UserRead, UserUpdate
from .users import auth_backend, fastapi_users, AUTH_URL_PATH
from fastapi.middleware.cors import CORSMiddleware
from .utils import simple_generate_unique_route_id
from app.middleware import TimingMiddleware
from app.logging_setup import configure_logging
from app.observability import init_growthbook, init_otel
from app.routes.extract import router as extract_router
from app.routes.documents import router as documents_router
from app.routes.jobs import router as jobs_router
from app.routes.refine import router as refine_router
from app.config import settings

# structlog has to be configured before any module-level loggers fire so
# all events flow through the trace-context + extraction-context
# processors. Idempotent — safe under uvicorn --reload.
configure_logging()

# Dedicated handler on the timing logger. Uvicorn doesn't attach a handler
# to the root logger (it only configures its own `uvicorn.*` namespace), so
# loggers that propagate up have nowhere to land. Scoped here so we don't
# accidentally enable INFO across every third-party library logger that
# otherwise propagates to root.
_timing_logger = logging.getLogger("triple_h.timing")
_timing_logger.setLevel(logging.INFO)
if not _timing_logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[%(name)s] %(message)s"))
    _timing_logger.addHandler(_h)
    _timing_logger.propagate = False

app = FastAPI(
    generate_unique_id_function=simple_generate_unique_route_id,
    openapi_url=settings.OPENAPI_URL,
)

# Observability bootstrap. Both calls are idempotent (safe under
# uvicorn --reload) and degrade gracefully when their backends are
# unreachable — the app still boots if Langfuse, GrowthBook, or an
# OTel collector are down.
init_otel(app)
init_growthbook()

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.CORS_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Outermost: wraps CORS + all routes so timing captures total request cost
app.add_middleware(TimingMiddleware)

# Include authentication and user management routes
app.include_router(
    fastapi_users.get_auth_router(auth_backend),
    prefix=f"/{AUTH_URL_PATH}/jwt",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_register_router(UserRead, UserCreate),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_reset_password_router(),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_verify_router(UserRead),
    prefix=f"/{AUTH_URL_PATH}",
    tags=["auth"],
)
app.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)

# Document extraction + persistence
app.include_router(extract_router)
app.include_router(jobs_router)
app.include_router(documents_router)

# VLM refinement of OCR scaffolds
app.include_router(refine_router)

add_pagination(app)
