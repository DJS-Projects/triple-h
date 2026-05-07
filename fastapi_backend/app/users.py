import uuid
import re

from typing import Optional

from fastapi import Depends, Request
from fastapi_users import (
    BaseUserManager,
    FastAPIUsers,
    UUIDIDMixin,
    InvalidPasswordException,
)

from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .database import get_async_session, get_user_db
from .email import send_reset_password_email
from .models import User
from .schemas import UserCreate

AUTH_URL_PATH = "auth"


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = settings.RESET_PASSWORD_SECRET_KEY
    verification_token_secret = settings.VERIFICATION_SECRET_KEY

    async def on_after_register(self, user: User, request: Optional[Request] = None):
        print(f"User {user.id} has registered.")

    async def on_after_forgot_password(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        await send_reset_password_email(user, token)

    async def on_after_request_verify(
        self, user: User, token: str, request: Optional[Request] = None
    ):
        print(f"Verification requested for user {user.id}. Verification token: {token}")

    async def validate_password(
        self,
        password: str,
        user: UserCreate,
    ) -> None:
        errors = []

        if len(password) < 8:
            errors.append("Password should be at least 8 characters.")
        if user.email in password:
            errors.append("Password should not contain e-mail.")
        if not any(char.isupper() for char in password):
            errors.append("Password should contain at least one uppercase letter.")
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password should contain at least one special character.")

        if errors:
            raise InvalidPasswordException(reason=errors)


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


bearer_transport = BearerTransport(tokenUrl=f"{AUTH_URL_PATH}/jwt/login")


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.ACCESS_SECRET_KEY,
        lifetime_seconds=settings.ACCESS_TOKEN_EXPIRE_SECONDS,
    )


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)


# ---------------------------------------------------------------------------
# Auth-free system user
# ---------------------------------------------------------------------------
# Single-tenant local tool — data routes don't require a JWT. Every upload /
# read resolves to one canonical "system" row so foreign keys
# (`Document.uploaded_by`, `RefinementRun.reviewer_id`) stay satisfied
# without forcing callers to log in. Auth router stays mounted for anyone
# who still wants to use it; the JWT just isn't checked on data routes.

SYSTEM_USER_EMAIL = "system@triple-h.local"
# Sentinel hash that won't validate via bcrypt — the system row exists for
# FK purposes only, never for login.
_SYSTEM_USER_PASSWORD_HASH = "!system!no-login!"  # noqa: S105


async def get_system_user(
    session: AsyncSession = Depends(get_async_session),
) -> User:
    """Return (or lazily create) the canonical system user.

    Used as a drop-in replacement for `current_active_user` on data routes
    so they work without an Authorization header. The row is created on
    first request — no migration needed.
    """
    result = await session.execute(select(User).where(User.email == SYSTEM_USER_EMAIL))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    user = User(
        id=uuid.uuid4(),
        email=SYSTEM_USER_EMAIL,
        hashed_password=_SYSTEM_USER_PASSWORD_HASH,
        is_active=True,
        is_superuser=False,
        is_verified=True,
    )
    session.add(user)
    await session.flush()
    return user
