FROM python:3.12-slim

WORKDIR /app

# System deps for PyMuPDF + fastembed (ONNX Runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the fastembed model so it's baked into the image
# (avoids a slow download on first search request at runtime)
RUN python -c "from fastembed import TextEmbedding; list(TextEmbedding('BAAI/bge-small-en-v1.5').embed(['warmup']))"

COPY . .

RUN mkdir -p /data/figures /data/pdfs

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
