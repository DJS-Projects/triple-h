FROM python:3.12-slim

# System deps for Tesseract OCR, PDF→image conversion, and OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install dotenvx
RUN curl -sfS https://dotenvx.sh | sh

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy project definition and install deps
COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen

# Copy backend code
COPY backend/doc_extractor/ ./

# Create PDF upload directory
RUN mkdir -p /app/pdfs
ENV PDFS_DIR=/app/pdfs

EXPOSE 8002

CMD ["dotenvx", "run", "--", "uv", "run", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]
