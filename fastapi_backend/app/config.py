from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    OPENAPI_URL: str = "/openapi.json"

    DATABASE_URL: str
    TEST_DATABASE_URL: str | None = None
    EXPIRE_ON_COMMIT: bool = False

    ACCESS_SECRET_KEY: str
    RESET_PASSWORD_SECRET_KEY: str
    VERIFICATION_SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_SECONDS: int = 3600

    MAIL_USERNAME: str | None = None
    MAIL_PASSWORD: str | None = None
    MAIL_FROM: str | None = None
    MAIL_SERVER: str | None = None
    MAIL_PORT: int | None = None
    MAIL_FROM_NAME: str = "FastAPI template"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True
    TEMPLATE_DIR: str = "email_templates"

    FRONTEND_URL: str = "http://localhost:3000"

    CORS_ORIGINS: set[str] = {"*"}

    GOOGLE_API_KEY: str | None = None
    OPENROUTER_API_KEY: str | None = None
    NVIDIA_NIM_API_KEY: str | None = None
    GROQ_API_KEY: str | None = None
    DOUBLEWORD_API_KEY: str | None = None

    CHANDRA_API_KEY: str | None = None
    CHANDRA_API_BASE_URL: str = "https://www.datalab.to/api/v1"

    LITELLM_BASE_URL: str = "http://litellm:4000"
    LITELLM_MASTER_KEY: str = "sk-triple-h-dev-key"

    # Blob storage. Local for now; switch to s3/gcs/rustfs by changing
    # BLOB_BACKEND and providing the corresponding env vars.
    BLOB_BACKEND: str = "local"
    BLOB_LOCAL_PATH: str = "/data/blobs"
    BLOB_PUBLIC_BASE_URL: str | None = None  # reserved for presigned-URL backends

    # OpenTelemetry. When OTEL_ENABLED is false the entire init is
    # short-circuited (no SDK setup, no auto-instrumentation, zero
    # overhead). When true and OTEL_EXPORTER_OTLP_ENDPOINT is unset,
    # we fall back to a console exporter — spans render into the
    # backend's stdout/docker logs, useful for local dev without a
    # collector. Set the endpoint to e.g. http://jaeger:4317 to
    # stream OTLP/gRPC into a real backend.
    OTEL_ENABLED: bool = True
    OTEL_SERVICE_NAME: str = "triple-h-backend"
    OTEL_EXPORTER_OTLP_ENDPOINT: str | None = None

    # Langfuse. The litellm proxy uses these directly via env (success
    # callback). Reserved here so any future backend-side direct calls
    # to the Langfuse SDK can read them from the same Settings object.
    LANGFUSE_HOST: str | None = None
    LANGFUSE_PUBLIC_KEY: str | None = None
    LANGFUSE_SECRET_KEY: str | None = None

    # GrowthBook. When both API_HOST and CLIENT_KEY are set, the
    # backend boots a GrowthBook client at startup and refreshes
    # flags on a periodic interval. When either is missing the
    # client stays None and `is_on()` calls degrade gracefully to
    # the supplied default (no flag = the safer code path).
    GROWTHBOOK_API_HOST: str | None = None
    GROWTHBOOK_CLIENT_KEY: str | None = None
    GROWTHBOOK_REFRESH_SECONDS: int = 60


settings = Settings()  # pyright: ignore[reportCallIssue]
