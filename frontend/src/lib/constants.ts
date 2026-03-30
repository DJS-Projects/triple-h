export const LOCAL_MODELS = [
	{ value: "gpt-oss:20b", label: "GPT-OSS 20B" },
	{ value: "gemma3", label: "Gemma 3" },
	{ value: "gemma3:27b", label: "Gemma 3 27B" },
	{ value: "llama3.1", label: "Llama 3.1" },
	{ value: "llama3.2", label: "Llama 3.2" },
	{ value: "qwen3", label: "Qwen 3" },
	{ value: "deepseek-r1", label: "DeepSeek R1" },
] as const;

export const CLOUD_MODELS = [
	{ value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
	{ value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
	{ value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
	{ value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
] as const;

export const OCR_MODELS = [
	{ value: "1", label: "PaddleOCR", description: "Best for handwritten + complex layouts" },
	{ value: "2", label: "Tesseract", description: "Best for printed text" },
	{ value: "3", label: "PP-Structure", description: "Advanced layout analysis" },
] as const;
