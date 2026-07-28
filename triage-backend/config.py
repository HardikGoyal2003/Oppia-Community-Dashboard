"""
Centralized configuration for the triage backend.

All env-var reads live here.  Every other module imports Config
instead of calling os.getenv() directly, making overrides (tests,
different environments) a single-argument change.
"""

import os
import logging
from dataclasses import dataclass, field

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


@dataclass
class Config:
    # ── GitHub ──────────────────────────────────────────────────────────
    github_token: str = field(default_factory=lambda: os.getenv("GITHUB_TOKEN", ""))

    # ── Firebase ────────────────────────────────────────────────────────
    firebase_client_email: str = field(default_factory=lambda: os.getenv("FIREBASE_CLIENT_EMAIL", ""))
    firebase_private_key: str = field(default_factory=lambda: os.getenv("FIREBASE_PRIVATE_KEY", ""))
    firebase_project_id: str = field(default_factory=lambda: os.getenv("FIREBASE_PROJECT_ID", "demo-oppia-community-dashboard"))

    # ── ChromaDB ────────────────────────────────────────────────────────
    chroma_db_path: str = field(default_factory=lambda: os.getenv("CHROMA_DB_PATH", "./chroma_db"))

    # ── Embedding model ─────────────────────────────────────────────────
    embedding_model: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"))

    # ── LLM (Hugging Face) ──────────────────────────────────────────────
    hf_api_token: str = field(default_factory=lambda: os.getenv("HF_API_TOKEN", ""))
    hf_model_id: str = field(default_factory=lambda: os.getenv("HF_MODEL_ID", "Qwen/Qwen2.5-7B-Instruct"))
    hf_providers_url: str = field(default_factory=lambda: os.getenv("HF_PROVIDERS_URL", "https://router.huggingface.co/v1/embeddings"))

    # ── Server ──────────────────────────────────────────────────────────
    host: str = field(default_factory=lambda: os.getenv("HOST", "0.0.0.0"))
    port: int = field(default_factory=lambda: int(os.getenv("PORT", "8000")))

    # ── Security ────────────────────────────────────────────────────────
    triage_api_key: str = field(default_factory=lambda: os.getenv("TRIAGE_API_KEY", ""))
    github_webhook_secret: str = field(default_factory=lambda: os.getenv("GITHUB_WEBHOOK_SECRET", ""))
    allowed_origins: list[str] = field(default_factory=lambda: [
        o.strip()
        for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if o.strip()
    ])

    # ── Batch limits ────────────────────────────────────────────────────
    max_batch_size: int = field(default_factory=lambda: int(os.getenv("MAX_BATCH_SIZE", "300")))

    # ── kNN classifier ──────────────────────────────────────────────────
    knn_default_k: int = field(default_factory=lambda: int(os.getenv("KNN_DEFAULT_K", "15")))
    knn_min_agreement: float = field(default_factory=lambda: float(os.getenv("KNN_MIN_AGREEMENT", "0.3")))
    knn_high_confidence_threshold: float = field(default_factory=lambda: float(os.getenv("KNN_HIGH_CONFIDENCE_THRESHOLD", "80.0")))
    knn_medium_confidence_threshold: float = field(default_factory=lambda: float(os.getenv("KNN_MEDIUM_CONFIDENCE_THRESHOLD", "50.0")))
    knn_high_weight: float = field(default_factory=lambda: float(os.getenv("KNN_HIGH_WEIGHT", "0.7")))
    knn_medium_weight: float = field(default_factory=lambda: float(os.getenv("KNN_MEDIUM_WEIGHT", "0.5")))
    knn_low_weight: float = field(default_factory=lambda: float(os.getenv("KNN_LOW_WEIGHT", "0.3")))

    # ── Triage labels (the set of labels the classifier can predict) ────
    triage_labels: set[str] = field(default_factory=lambda: set(
        os.getenv(
            "TRIAGE_LABELS",
            "bug,enhancement,feature,documentation,good first issue,"
            "impact-high,impact-medium,impact-low,CI breakage,"
            "translation,accessibility,performance",
        ).split(",")
    ))

    # ── Valid teams ─────────────────────────────────────────────────────
    valid_teams: set[str] = field(default_factory=lambda: {"LEAP", "CORE", "Developer Workflow"})

    # ── Team mapping ────────────────────────────────────────────────────
    team_map: dict[str, str] = field(default_factory=lambda: {
        "engineering": "CORE", "product": "CORE", "design": "CORE",
        "community": "LEAP", "docs": "Developer Workflow", "infra": "Developer Workflow",
    })


# Single global instance – every other module does `from config import config`.
config = Config()
