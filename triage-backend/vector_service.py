"""
Firestore native vector store for issue embeddings (ChromaDB replacement).

Uses Cloud Firestore's native KNN vector search (`find_nearest`) instead of a
local ChromaDB instance. This mirrors the ChromaService API so main.py only
swaps the import and the global name.

Emulator: FIRESTORE_EMULATOR_HOST is auto-set when the Firestore REST base in
config points at the local emulator. Production: leave that unset and the
google-cloud-firestore client uses Application Default Credentials. A vector
index on the `embedding` field must exist (emulator creates it implicitly,
real Firestore needs a deployed index).
"""

import os
import time
from typing import Optional

import logging

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.vector import Vector

from config import config

logger = logging.getLogger(__name__)

DISTANCE_MEASURE = DistanceMeasure.COSINE
DEFAULT_COLLECTION = "issueEmbeddings"
VERIFIED_STATES = ("accepted", "edited")


class VectorService:
    """Manage issue embeddings in a Firestore collection."""

    def __init__(self, collection: str = DEFAULT_COLLECTION):
        self.collection_name = collection
        self._col: Optional[firestore.CollectionReference] = None

    def initialize(self):
        """Point the client at the local emulator (when configured) and connect."""
        rest_base = config.firestore_rest_base or ""
        if "127.0.0.1" in rest_base or "localhost" in rest_base:
            os.environ.setdefault("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
        self._db = firestore.Client(project=config.firebase_project_id)
        self._col = self._db.collection(self.collection_name)
        logger.info(
            f"Firestore vector store '{self.collection_name}' ready "
            f"(emulator={bool(os.environ.get('FIRESTORE_EMULATOR_HOST'))})."
        )

    @property
    def collection(self):
        if self._col is None:
            raise RuntimeError("Vector store not initialized. Call initialize() first.")
        return self._col

    def count(self) -> int:
        """Approximate doc count via aggregation query."""
        try:
            snapshot = self.collection.count().get()
            return int(snapshot[0][0].value) if snapshot else 0
        except Exception as e:
            logger.warning(f"Vector store count failed: {e}")
            return 0

    def sample_dimension(self) -> Optional[int]:
        """Dimension of a stored embedding, or None when empty."""
        try:
            docs = self.collection.limit(1).get()
        except Exception as e:
            logger.warning(f"Vector store sample failed: {e}")
            return None
        if not docs:
            return None
        emb = docs[0].get("embedding")
        if emb is None:
            return None
        return len(emb.to_list() if hasattr(emb, "to_list") else emb)

    def _ref(self, issue_number: int):
        return self.collection.document(str(issue_number))

    def add_issue(
        self,
        issue_number: int,
        title: str,
        embedding: list[float],
        metadata: dict | None = None,
    ):
        """Add or update an issue embedding (upsert, full replace).

        WARNING: replaces any existing record. For unverified AI predictions
        use add_prediction(), which preserves reviewer-verified records.
        """
        meta = dict(metadata or {})
        meta["issueNumber"] = issue_number
        meta["title"] = title
        meta["embedding"] = Vector(embedding)
        meta["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self._ref(issue_number).set(meta)

    def add_prediction(
        self,
        issue_number: int,
        title: str,
        embedding: list[float],
        metadata: dict | None = None,
    ):
        """Store an unverified prediction WITHOUT overwriting verified ground truth."""
        try:
            existing = self._ref(issue_number).get()
            if existing.exists:
                state = existing.get("state", "")
                if state in VERIFIED_STATES:
                    logger.info(
                        f"Skipping vector write for #{issue_number}: "
                        f"verified record (state={state}) already exists."
                    )
                    return
        except Exception as e:
            logger.warning(f"Vector lookup failed for #{issue_number}: {e}")
        self.add_issue(issue_number, title, embedding, metadata)

    def search(self, embedding: list[float], n_results: int = 5) -> list[dict]:
        """Find nearest issues to the embedding (COSINE)."""
        try:
            docs = self.collection.find_nearest(
                vector_field="embedding",
                query_vector=Vector(embedding),
                distance_measure=DISTANCE_MEASURE,
                limit=n_results,
                distance_result_field="_dist",
            ).get()
        except Exception as e:
            logger.warning(f"Vector search failed: {e}")
            return []
        return self._parse(docs)

    def search_for_few_shot(
        self, embedding: list[float], n_results: int = 5
    ) -> list[dict]:
        """Find nearest REVIEWER-VERIFIED issues (accepted/edited with labels).

        Pre-filters on state so only verified decisions feed the LLM's
        few-shot examples.
        """
        try:
            docs = self.collection.where(
                filter=FieldFilter("state", "in", list(VERIFIED_STATES))
            ).find_nearest(
                vector_field="embedding",
                query_vector=Vector(embedding),
                distance_measure=DISTANCE_MEASURE,
                limit=n_results * 3,
                distance_result_field="_dist",
            ).get()
        except Exception as e:
            logger.warning(f"Vector few-shot search failed: {e}")
            return []

        few_shot = []
        for item in self._parse(docs):
            corrected = item.get("metadata", {}).get("corrected_labels")
            if corrected:
                few_shot.append(item)
                if len(few_shot) >= n_results:
                    break
        return few_shot

    def update_feedback(
        self,
        issue_number: int,
        review_status: str,
        corrected_labels: Optional[list[str]] = None,
        corrected_team: Optional[str] = None,
    ):
        """Store reviewer feedback on the issue's vector doc (learning loop)."""
        updates: dict = {"state": review_status}
        if corrected_labels is not None:
            updates["corrected_labels"] = corrected_labels
        if corrected_team is not None:
            updates["corrected_team"] = corrected_team
        try:
            self._ref(issue_number).update(updates)
            logger.info(
                f"Updated feedback for #{issue_number}: state={review_status}, "
                f"corrected_labels={corrected_labels}"
            )
        except Exception as e:
            logger.error(f"Failed to update feedback for #{issue_number}: {e}")

    def delete_issue(self, issue_number: int):
        self._ref(issue_number).delete()

    def _parse(self, docs: list) -> list[dict]:
        items = []
        for doc in docs:
            data = doc.to_dict() or {}
            metadata = {
                k: v
                for k, v in data.items()
                if k not in ("embedding", "title", "issueNumber", "updatedAt")
            }
            metadata["labels"] = metadata.get("labels") or []
            dist = doc.get("_dist")
            items.append({
                "number": data.get("issueNumber"),
                "title": data.get("title", ""),
                "distance": float(dist) if dist is not None else 1.0,
                "metadata": metadata,
            })
        return items