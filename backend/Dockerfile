FROM python:3.12-slim

WORKDIR /app

# System deps for PyMuPDF + fastembed (ONNX Runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /data/figures /data/pdfs

# Run migrations then start server (fastembed model downloads lazily on first search request)
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"]
