from .models import ModelInfo, ProviderConfig

PROVIDERS: dict[str, ProviderConfig] = {
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
