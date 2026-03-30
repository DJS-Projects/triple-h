"""AI model factory for Google Gemini and Ollama."""

from langchain_google_genai import ChatGoogleGenerativeAI

from config import CLOUD_MAX_OUTPUT_TOKENS, OLLAMA_BASE_URL

# Optional Ollama import
try:
    from langchain_ollama import ChatOllama

    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False


def create_ai_model(provider: str, model_name: str):
    """
    Create an AI model instance.

    Args:
        provider: "local" (Ollama) or "cloud" (Google Gemini)
        model_name: Model identifier (e.g. "gemini-2.0-flash", "gemma3")

    Returns:
        A LangChain chat model instance.
    """
    if provider == "local":
        if not OLLAMA_AVAILABLE:
            raise ValueError("Ollama is not available. Install with: pip install langchain-ollama")
        return ChatOllama(
            model=model_name,
            base_url=OLLAMA_BASE_URL,
            temperature=0.2,
            num_ctx=4096,
            format="json",
            num_predict=4096,
        )

    # Default: cloud (Google Gemini)
    return ChatGoogleGenerativeAI(
        model=model_name,
        temperature=0.2,
        max_output_tokens=CLOUD_MAX_OUTPUT_TOKENS,
        max_retries=3,
    )
