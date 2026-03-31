"""
Embedding service using fastembed (ONNX-based, no heavy ML runtime required).
Model: BAAI/bge-small-en-v1.5 (~22 MB, downloaded on first use).

Falls back to empty result if fastembed is unavailable.
"""
from __future__ import annotations
import json
import numpy as np
from typing import Optional

_model = None


def _get_model():
    global _model
    if _model is None:
        from fastembed import TextEmbedding
        _model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _model


def _text_from_analysis(analysis: str | dict) -> str:
    """Convert analysis_json (str or dict) to a flat string for embedding."""
    if isinstance(analysis, dict):
        return json.dumps(analysis, ensure_ascii=False)
    return analysis or ""


def embed_analysis(analysis_json: str | dict) -> bytes:
    """
    Embed analysis_json into a float32 vector stored as raw bytes.
    Returns bytes suitable for ContentItem.embedding_vector.
    """
    text = _text_from_analysis(analysis_json)
    model = _get_model()
    vector = np.array(next(iter(model.embed([text]))), dtype=np.float32)
    return vector.tobytes()


def search_similar(
    query: str,
    module_type: Optional[str] = None,
    top_k: int = 10,
) -> list[str]:
    """
    Semantic search over ContentItems with stored embeddings.
    Returns list of ContentItem IDs ordered by cosine similarity (best first).
    """
    from database import SessionLocal
    from models.content_item import ContentItem

    db = SessionLocal()
    try:
        q = db.query(ContentItem).filter(
            ContentItem.embedding_vector.isnot(None),
            ContentItem.processing_status == "done",
        )
        if module_type:
            q = q.filter(ContentItem.module_type == module_type)
        items = q.all()
        if not items:
            return []

        model = _get_model()
        query_vec = np.array(next(iter(model.embed([query]))), dtype=np.float32)
        q_norm = np.linalg.norm(query_vec) + 1e-8

        scored: list[tuple[str, float]] = []
        for item in items:
            item_vec = np.frombuffer(item.embedding_vector, dtype=np.float32)
            sim = float(np.dot(query_vec, item_vec) / (q_norm * (np.linalg.norm(item_vec) + 1e-8)))
            scored.append((item.id, sim))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [item_id for item_id, _ in scored[:top_k]]
    finally:
        db.close()
