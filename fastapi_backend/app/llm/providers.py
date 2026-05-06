"""LLM provider + model registry.

Default path: `litellm` proxy (OpenAI-compatible sidecar at LITELLM_BASE_URL).
LiteLLM handles multi-provider routing, fallbacks, retries via its config.yaml.
Backend just talks to one stable endpoint with virtual model names.

Direct providers (nim, openrouter, gemini) kept for cases where bypassing
the proxy is useful (eval harness, debugging single-provider behavior).
"""

from .models import ModelInfo, ProviderConfig

PROVIDERS: dict[str, ProviderConfig] = {
    # ── LiteLLM proxy (default) ─────────────────────────────────────────
    "litellm": ProviderConfig(
        kind="openai_compatible",
        env_key="LITELLM_MASTER_KEY",
        base_url="http://litellm:4000",
        models={
            "vision-primary": ModelInfo(
                api_id="vision-primary",  # Groq Llama 4 Scout
                context=128_000,
            ),
            "vision-primary-large": ModelInfo(
                api_id="vision-primary-large",  # Groq Llama 4 Maverick
                context=128_000,
            ),
            "vision-fallback-1": ModelInfo(
                api_id="vision-fallback-1",  # NIM Llama 3.2 90B Vision
                context=128_000,
            ),
            "structured-primary": ModelInfo(
                api_id="structured-primary",  # Doubleword Qwen3.5-397B + dottxt
                context=128_000,
            ),
            "chat-primary": ModelInfo(
                api_id="chat-primary",  # Groq Llama 3.3 70B
                context=128_000,
            ),
        },
    ),
    # ── Direct providers (bypass LiteLLM) ───────────────────────────────
    "nim": ProviderConfig(
        kind="openai_compatible",
        env_key="NVIDIA_NIM_API_KEY",
        base_url="https://integrate.api.nvidia.com/v1",
        models={
            "llama-3.3-70b": ModelInfo(
                api_id="meta/llama-3.3-70b-instruct",
                context=128_000,
            ),
        },
    ),
    "openrouter": ProviderConfig(
        kind="openai_compatible",
        env_key="OPENROUTER_API_KEY",
        base_url="https://openrouter.ai/api/v1",
        models={
            "claude-3.5-sonnet": ModelInfo(
                api_id="anthropic/claude-3.5-sonnet",
                context=200_000,
            ),
        },
    ),
    "gemini": ProviderConfig(
        kind="google",
        env_key="GOOGLE_API_KEY",
        models={
            "gemini-2.5-flash": ModelInfo(
                api_id="gemini-2.5-flash",
                context=1_000_000,
            ),
        },
    ),
}
