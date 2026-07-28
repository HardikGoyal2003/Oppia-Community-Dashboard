"""
ChromaDB vector storage for issue embeddings.

Supports:
- Semantic similarity search
- Feedback-aware search (only accepted/edited issues for few-shot learning)
- Label updates from reviewer corrections
"""

import json
import logging

from config import config

logger = logging.getLogger(__name__)


class ChromaService:
    """Manages ChromaDB collections for issue embeddings."""

    def __init__(self):
        self._collection = None
        self._client = None

    def initialize(self):
        """Initialize ChromaDB client and create/get collection."""
        import chromadb
        from chromadb.config import Settings

        db_path = config.chroma_db_path
        self._client = chromadb.PersistentClient(
            path=db_path,
            settings=Settings(anonymized_telemetry=False),
        )
        self._collection = self._client.get_or_create_collection(
            name="oppia_issues",
            metadata={"hnsw:space": "cosine"},
        )
        count = self._collection.count()
        logger.info(f"ChromaDB collection 'oppia_issues' ready with {count} existing issues.")

    @property
    def collection(self):
        if self._collection is None:
            raise RuntimeError("ChromaDB not initialized. Call initialize() first.")
        return self._collection

    def add_issue(
        self,
        issue_number: int,
        title: str,
        embedding: list[float],
        metadata: dict | None = None,
    ):
        """Add or update an issue embedding in the collection.

        WARNING: this REPLACES any existing record (upsert). Use it only for
        seeding ground truth. For unverified AI predictions use
        add_prediction(), which never overwrites verified records.
        """
        safe_metadata = self._sanitize_metadata(metadata)
        self.collection.upsert(
            ids=[str(issue_number)],
            embeddings=[embedding],
            metadatas=[safe_metadata],
            documents=[title],
        )

    def add_prediction(
        self,
        issue_number: int,
        title: str,
        embedding: list[float],
        metadata: dict | None = None,
    ):
        """Store an unverified AI prediction WITHOUT overwriting ground truth.

        If the issue already exists in the collection with a verified state
        ('accepted' or 'edited' — i.e. seeded ground truth or reviewer-
        confirmed data), the existing record is left untouched. Only brand-new
        issues (or ones still 'pending') are written.
        """
        try:
            existing = self.collection.get(
                ids=[str(issue_number)], include=["metadatas"]
            )
            if existing["ids"]:
                meta = existing["metadatas"][0] if existing["metadatas"] else {}
                state = meta.get("state", "")
                if state in ("accepted", "edited"):
                    logger.info(
                        f"Skipping ChromaDB write for #{issue_number}: "
                        f"verified record (state={state}) already exists."
                    )
                    return
        except Exception as e:
            logger.warning(f"ChromaDB lookup failed for #{issue_number}: {e}")

        self.add_issue(issue_number, title, embedding, metadata)

    def search(
        self, embedding: list[float], n_results: int = 5
    ) -> list[dict]:
        """Search for similar issues by embedding."""
        try:
            results = self.collection.query(
                query_embeddings=[embedding],
                n_results=n_results,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.warning(f"ChromaDB search failed: {e}")
            return []

        return self._parse_results(results)

    def search_for_few_shot(
        self, embedding: list[float], n_results: int = 5
    ) -> list[dict]:
        """Search for similar issues that were accepted or edited (for few-shot learning).

        Only returns issues where state is 'accepted' or 'edited' and has
        corrected labels, so the LLM gets high-quality examples.
        """
        try:
            results = self.collection.query(
                query_embeddings=[embedding],
                n_results=n_results * 3,  # Fetch more to filter
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.warning(f"ChromaDB few-shot search failed: {e}")
            return []

        all_items = self._parse_results(results)

        # Filter to only accepted/edited issues with corrected labels
        few_shot = []
        for item in all_items:
            meta = item.get("metadata", {})
            state = meta.get("state", "")
            corrected_labels = meta.get("corrected_labels", "")
            if state in ("accepted", "edited") and corrected_labels:
                few_shot.append(item)
                if len(few_shot) >= n_results:
                    break

        return few_shot

    def update_feedback(
        self,
        issue_number: int,
        review_status: str,
        corrected_labels: list[str] | None = None,
        corrected_team: str | None = None,
    ):
        """Update an issue's metadata with reviewer feedback.

        This is the core of the learning loop — when a reviewer accepts/edits,
        we update the metadata so future few-shot searches use corrected labels.
        """
        try:
            existing = self.collection.get(
                ids=[str(issue_number)],
                include=["metadatas"],
            )
            if not existing["ids"]:
                logger.warning(f"Issue #{issue_number} not found in ChromaDB for feedback update.")
                return

            meta = existing["metadatas"][0] if existing["metadatas"] else {}
            meta["state"] = review_status

            if corrected_labels is not None:
                meta["corrected_labels"] = json.dumps(corrected_labels)
            if corrected_team is not None:
                meta["corrected_team"] = corrected_team

            self.collection.update(
                ids=[str(issue_number)],
                metadatas=[meta],
            )
            logger.info(
                f"Updated feedback for #{issue_number}: state={review_status}, "
                f"corrected_labels={corrected_labels}"
            )
        except Exception as e:
            logger.error(f"Failed to update feedback for #{issue_number}: {e}")

    def delete_issue(self, issue_number: int):
        """Remove an issue from the collection."""
        self.collection.delete(ids=[str(issue_number)])

    def count(self) -> int:
        """Return the number of issues in the collection."""
        return self.collection.count()

    def _sanitize_metadata(self, metadata: dict | None) -> dict:
        """Convert metadata values to ChromaDB-compatible types."""
        safe = {}
        for k, v in (metadata or {}).items():
            if isinstance(v, list):
                safe[k] = json.dumps(v)
            elif isinstance(v, (str, int, float, bool)):
                safe[k] = v
            else:
                safe[k] = str(v)
        return safe

    def _parse_results(self, results: dict) -> list[dict]:
        """Parse ChromaDB query results into a list of dicts."""
        if not results["ids"] or not results["ids"][0]:
            return []

        items = []
        for i in range(len(results["ids"][0])):
            meta = results["metadatas"][0][i] if results.get("metadatas") else {}
            # Deserialize JSON fields
            for field in ("labels", "corrected_labels"):
                if field in meta and isinstance(meta[field], str):
                    try:
                        meta[field] = json.loads(meta[field])
                    except (json.JSONDecodeError, TypeError):
                        pass

            items.append({
                "number": int(results["ids"][0][i]),
                "title": results["documents"][0][i] if results.get("documents") else "",
                "distance": results["distances"][0][i] if results.get("distances") else 1.0,
                "metadata": meta,
            })

        return items
