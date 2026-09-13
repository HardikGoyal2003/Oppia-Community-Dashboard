"""
Team inference helpers for Oppia issues.

The kNN label classifier was removed — the LLM is now the sole predictor.
This module keeps the content-keyword-based team inference used to label
seed/feedback metadata (e.g. when storing verified ground truth).
"""

import logging

from config import config

logger = logging.getLogger(__name__)

# Keyword signals used to infer the owning team from labels/title text.
# Handles legacy seed data (e.g. 'Engineering' -> CORE) and improves on the
# old label-only heuristic that mislabeled most issues as CORE.
LEAP_KEYWORDS = [
    "translation", "i18n", "l10n", "localization", "multilingual", "locale",
    "accessibility", "a11y", "voiceover", "community", "gsoc", "outreach",
    "sign language", "caption", "subtitle", "screen reader", "wcag", "aria",
]
DW_KEYWORDS = [
    "documentation", "ci breakage", "ci failure", "continuous integration",
    "infrastructure", "deploy", "tooling", "code quality", "lint",
    "appengine", "app.yaml", "devtool", "developer workflow", "docs",
    "flaky", "pipeline", "build fail", "test fail",
]


def infer_team(labels: list[str] | None = None, title: str = "") -> str:
    """Infer the owning team (LEAP | CORE | Developer Workflow) from labels.

    Labels are checked first (they are more specific), then the title text.
    Falls back to CORE, which is the default owner for product/engineering
    work.
    """
    label_text = " ".join(labels or []).lower()
    title_text = (title or "").lower()

    for kw in LEAP_KEYWORDS:
        if kw in label_text or kw in title_text:
            return "LEAP"
    for kw in DW_KEYWORDS:
        if kw in label_text or kw in title_text:
            return "Developer Workflow"
    return "CORE"
