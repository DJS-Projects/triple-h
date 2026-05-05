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

    CHANDRA_API_KEY: str | None = None
    CHANDRA_API_BASE_URL: str = "https://www.datalab.to/api/v1"


settings = Settings()  # type: ignore[call-arg]
