"""
LLM service for generating triage predictions.

Uses Hugging Face Inference Providers (OpenAI-compatible endpoint).
Falls back to heuristic prediction if the API is unavailable.
"""

import os
import json
import re
import logging

logger = logging.getLogger(__name__)

TRIAGE_SYSTEM_PROMPT = """You are an expert issue triage assistant for the Oppia open-source project (a free online education platform).

Your job is to analyze GitHub issues and predict the correct triage labels based on the issue's CONTENT, not its existing labels.

## How to analyze
1. Read the issue title and body carefully
2. Identify the core problem, feature request, or task described
3. Look for keywords, patterns, and context clues
4. Consider the impact on learners, creators, and contributors

## Response format
Respond with a JSON object containing:
- labels: array of label names that SHOULD BE ADDED (not including existing labels). Choose from: bug, enhancement, feature, documentation, good first issue, impact-high, impact-medium, impact-low, CI breakage, translation, accessibility, performance
- newLabels: array of ONLY the labels that are NEW and should be added to the issue (exclude existing labels)
- team: one of Engineering, Product, Design, Community, Docs, Developer Workflow, LEAP, CORE, Infra
- repository: one of oppia/oppia, oppia/oppia-android, oppia/product-operations, oppia/design
- cuj: one of Learner Experience, Creator Experience, Translation Review, Community Management, Infrastructure, Onboarding, None
- goodFirstIssue: boolean (true if the issue is well-scoped and suitable for new contributors)
- priority: one of critical, high, medium, low
- severity: one of blocker, major, minor, trivial
- confidenceScore: number between 0-100
- explanation: a detailed 2-3 sentence explanation that describes WHY you chose these labels, referencing specific parts of the issue content. For example: "The issue reports a crash when submitting a translation, indicating a bug. The mention of 'translation' and 'i18n' suggests the translation team should handle this. The crash affects all users attempting to submit, making it impact-high."

Respond with ONLY valid JSON, no other text."""

TRIAGE_USER_PROMPT_TEMPLATE = """Issue Title: {title}
Issue Description: {body}
Existing labels on this issue: {existing_labels}

{context}

Analyze this issue and predict which labels should be ADDED (newLabels) based on the content. Do NOT suggest labels that already exist on the issue."""


class LLMService:
    """Generates triage predictions using Hugging Face Inference Providers."""

    def __init__(self):
        self._api_token = os.getenv("HF_API_TOKEN", "")
        self._model = os.getenv("HF_MODEL_ID", "Qwen/Qwen2.5-7B-Instruct")
        self._api_url = "https://router.huggingface.co/v1/chat/completions"

    def predict(self, title: str, body: str, context: str = "", existing_labels: list[str] = None) -> dict:
        """
        Run triage prediction using the LLM.

        Falls back to a heuristic-based prediction if the API is unavailable.
        """
        try:
            return self._query_llm(title, body, context, existing_labels or [])
        except Exception as e:
            logger.warning(f"LLM query failed: {e}. Using fallback heuristic.")
            return self._fallback_prediction(title, body, existing_labels or [])

    def _query_llm(self, title: str, body: str, context: str, existing_labels: list[str]) -> dict:
        """Query the LLM via Hugging Face Inference Providers (OpenAI-compatible)."""
        import httpx

        existing_labels_str = ", ".join(existing_labels) if existing_labels else "none"

        user_prompt = TRIAGE_USER_PROMPT_TEMPLATE.format(
            title=title,
            body=body[:2000],  # Truncate to avoid token limits
            existing_labels=existing_labels_str,
            context=context or "No similar issues found.",
        )

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 512,
            "temperature": 0.1,
        }

        headers = {"Content-Type": "application/json"}
        if self._api_token:
            headers["Authorization"] = f"Bearer {self._api_token}"

        response = httpx.post(
            self._api_url,
            json=payload,
            headers=headers,
            timeout=120,
        )
        response.raise_for_status()

        result = response.json()

        # OpenAI-compatible response format
        choices = result.get("choices", [])
        if choices and len(choices) > 0:
            raw = choices[0].get("message", {}).get("content", "{}")
        else:
            raw = json.dumps(result)

        # Try to parse JSON from the response
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            # Try extracting JSON block (strip markdown code fences)
            cleaned = re.sub(r"```json\s*", "", raw)
            cleaned = re.sub(r"```\s*$", "", cleaned)
            cleaned = cleaned.strip()
            try:
                return json.loads(cleaned)
            except json.JSONDecodeError:
                match = re.search(r"\{.*\}", raw, re.DOTALL)
                if match:
                    return json.loads(match.group())
                raise ValueError(f"Could not parse LLM response: {raw[:300]}")

    def _fallback_prediction(self, title: str, body: str, existing_labels: list[str] = None) -> dict:
        """Heuristic-based fallback when LLM is unavailable."""
        text = f"{title} {body}".lower()
        existing_labels = existing_labels or []

        is_bug = any(kw in text for kw in ["bug", "crash", "error", "broken", "fail", "unexpected"])
        is_translation = any(kw in text for kw in ["translation", "i18n", "locale", "language"])
        is_perf = any(kw in text for kw in ["performance", "slow", "lag", "latency"])
        is_docs = any(kw in text for kw in ["doc", "readme", "typo", "documentation"])
        is_feature = any(kw in text for kw in ["feature", "request", "would like", "please add"])
        is_accessibility = any(kw in text for kw in ["accessibility", "a11y", "screen reader", "wcag", "aria"])
        is_ci = any(kw in text for kw in ["ci break", "ci failure", "build fail", "test fail", "pipeline"])

        all_labels = []
        if is_bug:
            all_labels.append("bug")
        elif is_feature:
            all_labels.append("enhancement")
        else:
            all_labels.append("bug")

        if is_translation:
            all_labels.append("translation")
        if is_perf:
            all_labels.append("performance")
        if is_docs:
            all_labels.append("documentation")
        if is_accessibility:
            all_labels.append("accessibility")
        if is_ci:
            all_labels.append("CI breakage")

        new_labels = [l for l in all_labels if l not in existing_labels]

        team = "Engineering"
        if is_translation:
            team = "Community"
        elif is_docs:
            team = "Docs"

        cuj = "Learner Experience"
        if is_translation:
            cuj = "Translation Review"

        priority = "high" if is_bug else "medium"
        severity = "major" if is_bug else "minor"

        # Build a detailed explanation
        reasons = []
        if is_bug:
            reasons.append("The issue describes a bug or error — the title/body contains keywords like 'crash', 'error', or 'broken'")
        if is_feature:
            reasons.append("The issue is a feature request — the title/body contains keywords like 'feature', 'request', or 'please add'")
        if is_translation:
            reasons.append("The issue relates to translations — keywords like 'translation', 'i18n', or 'locale' were found")
        if is_perf:
            reasons.append("The issue mentions performance concerns — keywords like 'slow' or 'latency' were detected")
        if is_docs:
            reasons.append("The issue involves documentation — keywords like 'readme' or 'typo' were found")
        if is_accessibility:
            reasons.append("The issue addresses accessibility — keywords like 'screen reader' or 'wcag' were found")
        if is_ci:
            reasons.append("The issue involves CI/build failures — keywords like 'test fail' or 'pipeline' were detected")
        if not reasons:
            reasons.append("The issue was analyzed but no strong keyword signals were found — defaulting to bug classification")

        team_reason = f"The {team} team was selected based on {'translation-related content' if is_translation else 'documentation-related content' if is_docs else 'general engineering scope'}."
        explanation = " ".join(reasons) + " " + team_reason

        return {
            "labels": all_labels,
            "newLabels": new_labels,
            "team": team,
            "repository": "oppia/oppia",
            "cuj": cuj,
            "goodFirstIssue": is_bug and not is_translation,
            "priority": priority,
            "severity": severity,
            "confidenceScore": 80.0,
            "explanation": explanation,
            "similarIssues": [],
        }
