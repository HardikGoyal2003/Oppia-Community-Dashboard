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
    github_repo: str = field(default_factory=lambda: os.getenv("GITHUB_REPO", "oppia/oppia"))

    # ── Firebase ────────────────────────────────────────────────────────
    firebase_client_email: str = field(default_factory=lambda: os.getenv("FIREBASE_CLIENT_EMAIL", ""))
    firebase_private_key: str = field(default_factory=lambda: os.getenv("FIREBASE_PRIVATE_KEY", ""))
    firebase_project_id: str = field(default_factory=lambda: os.getenv("FIREBASE_PROJECT_ID", "demo-oppia-community-dashboard"))
    # Firestore REST base URL used by the retriage sweep (emulator default,
    # and the only path that works without service-account credentials).
    firestore_rest_base: str = field(default_factory=lambda: os.getenv(
        "FIRESTORE_REST_BASE",
        "http://127.0.0.1:8080/v1/projects/demo-oppia-community-dashboard/"
        "databases/(default)/documents",
    ))

    # ── ChromaDB ────────────────────────────────────────────────────────
    chroma_db_path: str = field(default_factory=lambda: os.getenv("CHROMA_DB_PATH", "./chroma_db"))

    # ── Embedding model ─────────────────────────────────────────────────
    embedding_model: str = field(default_factory=lambda: os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"))

    # ── LLM (OpenAI-compatible provider, default Groq free tier) ──────
    llm_api_key: str = field(default_factory=lambda: os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY", ""))
    llm_base_url: str = field(default_factory=lambda: os.getenv("LLM_BASE_URL", "https://api.groq.com/openai/v1"))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "qwen/qwen3.8-27b"))
    llm_timeout: float = field(default_factory=lambda: float(os.getenv("LLM_TIMEOUT", "90")))

    # ── Embedding (legacy HF config kept for remote embedding fallbacks) ─
    hf_api_token: str = field(default_factory=lambda: os.getenv("HF_API_TOKEN", ""))
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

    # ── Triage labels (the set of labels the LLM can suggest) ──────────
    triage_labels: set[str] = field(default_factory=lambda: set(
        os.getenv(
            "TRIAGE_LABELS",
            "bug,enhancement,CI breakage,good first issue,"
            "frontend,backend,full-stack,server errors,"
            "a11y,accessibility,audio-translation,"
            "Impact: High,Impact: Medium,Impact: Low,"
            "Work: Low,Work: Medium,Work: High,"
            "performance,documentation,needs debugging,"
            "Flake: Acceptance,important",
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
