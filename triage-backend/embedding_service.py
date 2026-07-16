"""
Embedding service for converting issue text to vectors.
"""

import os
import logging

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Generates embeddings for issue text using sentence-transformers."""

    def __init__(self):
        self._model = None
        self._model_name = os.getenv("EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5")
        self._dimension = 1024  # bge-large-en-v1.5 output dimension

    def load_model(self):
        """Load the embedding model."""
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading embedding model: {self._model_name}")
        self._model = SentenceTransformer(self._model_name)
        self._dimension = self._model.get_sentence_embedding_dimension()
        logger.info(f"Model loaded. Embedding dimension: {self._dimension}")

    def embed(self, text: str) -> list[float]:
        """Convert text to an embedding vector."""
        if self._model is not None:
            embedding = self._model.encode(text, normalize_embeddings=True)
            return embedding.tolist()

        # Fallback mock embedding for development without the model
        logger.warning("Using mock embedding (model not loaded)")
        import hashlib
        import struct

        mock = []
        seed_bytes = hashlib.sha256(text.encode()).digest()
        for i in range(self._dimension):
            byte_val = seed_bytes[(i * 4) % len(seed_bytes) : (i * 4 + 4) % len(seed_bytes)]
            if len(byte_val) < 4:
                byte_val = byte_val * (4 // len(byte_val) + 1)
            (val,) = struct.unpack(">f", byte_val[:4])
            mock.append(val / 1e8)  # Normalize to small floats

        magnitude = sum(v * v for v in mock) ** 0.5
        return [v / magnitude for v in mock]
