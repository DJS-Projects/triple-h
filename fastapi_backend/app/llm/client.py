import os

from pydantic_ai.models import Model
from pydantic_ai.models.google import GoogleModel
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.google import GoogleProvider
from pydantic_ai.providers.openai import OpenAIProvider

from .providers import PROVIDERS


def get_model(provider_id: str, model_id: str) -> Model:
    if provider_id not in PROVIDERS:
        raise ValueError(f"Unknown provider: {provider_id}")
    cfg = PROVIDERS[provider_id]
    if model_id not in cfg.models:
        raise ValueError(f"Unknown model {model_id} for provider {provider_id}")

    api_key = os.environ.get(cfg.env_key)
    if not api_key:
        raise RuntimeError(f"Missing env var {cfg.env_key} for provider {provider_id}")

    info = cfg.models[model_id]

    if cfg.kind == "openai_compatible":
        return OpenAIChatModel(
            info.api_id,
            provider=OpenAIProvider(base_url=cfg.base_url, api_key=api_key),
        )
    if cfg.kind == "google":
        return GoogleModel(info.api_id, provider=GoogleProvider(api_key=api_key))
    raise ValueError(f"Unsupported provider kind: {cfg.kind}")
