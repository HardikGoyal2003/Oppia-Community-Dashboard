"""
Embedding service for converting issue text to vectors.

Uses local sentence-transformers model (fast, reliable) with optional
HF API for remote embedding generation.
"""

import logging

from config import config

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Generates embeddings for issue text using local or remote models."""

    def __init__(self):
        self._model_name = config.embedding_model
        self._api_token = config.hf_api_token
        self._providers_url = config.hf_providers_url
        self._dimension = 384  # all-MiniLM-L6-v2 produces 384-dim vectors; updated on load
        self._local_model = None

    def load_model(self):
        """Load the local sentence-transformers model (primary method)."""
        self._load_local()

    def _load_local(self):
        """Load model locally."""
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading local embedding model: {self._model_name}")
            self._local_model = SentenceTransformer(self._model_name)
            self._dimension = self._local_model.get_sentence_embedding_dimension()
            logger.info(f"Local model loaded. Dimension: {self._dimension}")
        except Exception as e:
            logger.error(f"Could not load local model: {e}")

    def is_loaded(self) -> bool:
        """Whether embeddings can be generated."""
        return self._local_model is not None

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimension(self) -> int | None:
        return self._dimension

    def embed(self, text: str) -> list[float]:
        """Convert text to an embedding vector."""
        if self._local_model:
            embedding = self._local_model.encode(text, normalize_embeddings=True)
            return embedding.tolist()

        raise RuntimeError(
            "No embedding method available. Ensure "
            "sentence-transformers is installed for local fallback."
        )

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Embed many texts at once."""
        if self._local_model:
            embeddings = self._local_model.encode(texts, normalize_embeddings=True)
            return embeddings.tolist()

        raise RuntimeError(
            "No embedding method available. Ensure "
            "sentence-transformers is installed for local fallback."
        )
