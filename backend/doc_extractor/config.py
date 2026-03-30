import os

from dotenv import load_dotenv

load_dotenv()

# Google Gemini API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY not found in .env")

# PDF storage
PDFS_DIR = os.getenv("PDFS_DIR", "../pdfs")
os.makedirs(PDFS_DIR, exist_ok=True)

# Default OCR engine: "tesseract", "paddleocr", or "ppstructure"
DEFAULT_OCR_ENGINE = os.getenv("DEFAULT_OCR_ENGINE", "tesseract")

# Handwriting confidence threshold (0.0 to 1.0)
# Values BELOW this are considered handwriting and filtered
DEFAULT_CONFIDENCE_THRESHOLD = float(os.getenv("DEFAULT_CONFIDENCE_THRESHOLD", "0.1"))

# Ollama (local LLM) configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_AVAILABLE_MODELS = [
    "gpt-oss:20b",
    "gemma",
    "gemma3",
    "llama3.1",
    "llama3.2",
    "qwen3",
]

# AI model defaults
DEFAULT_PROVIDER = os.getenv("DEFAULT_PROVIDER", "cloud")  # "local" or "cloud"
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gemini-2.0-flash")

# Context limits
MAX_OLLAMA_CONTEXT_CHARS = int(os.getenv("MAX_OLLAMA_CONTEXT_CHARS", "20000"))
CLOUD_MAX_OUTPUT_TOKENS = int(os.getenv("CLOUD_MAX_OUTPUT_TOKENS", "30192"))

# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

# Server
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8002"))
