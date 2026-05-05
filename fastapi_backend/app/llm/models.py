from dataclasses import dataclass, field
from typing import Literal

ProviderKind = Literal["openai_compatible", "google", "anthropic"]


@dataclass(frozen=True)
class ModelInfo:
    api_id: str
    context: int
    supports_structured_output: bool = True
    cost_input_per_mtok: float | None = None
    cost_output_per_mtok: float | None = None


@dataclass(frozen=True)
class ProviderConfig:
    kind: ProviderKind
    env_key: str
    base_url: str | None = None
    models: dict[str, ModelInfo] = field(default_factory=dict)
