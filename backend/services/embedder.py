import json


def embed_analysis(analysis_json: str | dict) -> bytes:
    """
    Embed analysis_json into a vector.
    Returns serialized float32 bytes for storage in ContentItem.embedding_vector.
    """
    # TODO: use sentence-transformers or Anthropic embeddings
    raise NotImplementedError


def search_similar(query: str, module_type: str | None = None, top_k: int = 10) -> list[str]:
    """
    Semantic search over ContentItem embeddings.
    Returns list of ContentItem IDs ordered by similarity.
    """
    # TODO: query ChromaDB / Qdrant collection
    raise NotImplementedError
