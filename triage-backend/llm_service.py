"""
LLM service for generating triage predictions.

Uses an OpenAI-compatible chat completions endpoint (default: Groq free
tier) with fallback to heuristic prediction if the API is unavailable.
The LLM is the sole predictor — it receives few-shot examples and similar
historical issues as CONTEXT, then decides labels/team/priority itself.
"""

import json
import re
import logging

from config import config

logger = logging.getLogger(__name__)

VALID_TEAMS = config.valid_teams

TRIAGE_SYSTEM_PROMPT_TPL = """You are an expert issue triage assistant for the Oppia open-source project (a free online education platform).

Your job is to analyze GitHub issues and predict the correct triage labels based on the issue's CONTENT, not its existing labels.

## How to analyze
1. Read the issue title and body carefully
2. Identify the core problem, feature request, or task described
3. Look for keywords, patterns, and context clues
4. Consider the impact on learners, creators, and contributors

## Response format
Respond with a JSON object containing:
- labels: array of label names that SHOULD BE ADDED (not including existing labels). Choose from: {label_list}
- newLabels: array of ONLY the labels that are NEW and should be added to the issue (exclude existing labels)
- team: one of {team_list}
- repository: one of oppia/oppia, oppia/oppia-android, oppia/product-operations, oppia/design
- cuj: one of Learner Experience, Creator Experience, Translation Review, Community Management, Infrastructure, Onboarding, None
- goodFirstIssue: boolean (true if the issue is well-scoped and suitable for new contributors)
- priority: one of critical, high, medium, low
- severity: one of blocker, major, minor, trivial
- confidenceScore: number between 0-100
- explanation: a detailed 2-3 sentence explanation that describes WHY you chose these labels, referencing specific parts of the issue content.

Respond with ONLY valid JSON, no other text."""

TRIAGE_USER_PROMPT_TEMPLATE = """Issue Title: {title}
Issue Description: {body}
Existing labels on this issue: {existing_labels}

{context}

Analyze this issue and predict which labels should be ADDED (newLabels) based on the content. Do NOT suggest labels that already exist on the issue."""


class LLMService:
    """Generates triage predictions using an OpenAI-compatible provider."""

    def __init__(self):
        self._api_key = config.llm_api_key
        self._model = config.llm_model
        self._base_url = config.llm_base_url
        self._timeout = config.llm_timeout
        self._client = None

    def _get_client(self):
        """Lazy-init the OpenAI-compatible client."""
        if self._client is None:
            import openai
            self._client = openai.OpenAI(
                # A placeholder is fine for local servers (Ollama etc.);
                # the real key is only required by hosted providers.
                api_key=self._api_key or "not-set",
                base_url=self._base_url,
                timeout=self._timeout,
            )
        return self._client

    def predict(self, title: str, body: str, context: str = "", existing_labels: list[str] = None) -> dict:
        """Run triage prediction using the LLM.

        Falls back to a heuristic-based prediction if the API is unavailable.
        """
        try:
            return self._query_llm(title, body, context, existing_labels or [])
        except Exception as e:
            logger.warning(f"LLM query failed: {e}. Using fallback heuristic.")
            return self._fallback_prediction(title, body, existing_labels or [])

    def _query_llm(self, title: str, body: str, context: str, existing_labels: list[str]) -> dict:
        """Query the LLM via an OpenAI-compatible chat completions endpoint.

        First tries structured JSON output (response_format); if the model
        does not support it, retries with plain chat so nothing is lost.
        """
        existing_labels_str = ", ".join(existing_labels) if existing_labels else "none"

        system_prompt = TRIAGE_SYSTEM_PROMPT_TPL.format(
            label_list=", ".join(sorted(config.triage_labels)),
            team_list=", ".join(sorted(config.valid_teams)),
        )

        user_prompt = TRIAGE_USER_PROMPT_TEMPLATE.format(
            title=title,
            body=body[:2000],
            existing_labels=existing_labels_str,
            context=context or "No similar issues found.",
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        client = self._get_client()
        kwargs = {
            "model": self._model,
            "messages": messages,
            "max_tokens": 512,
            "temperature": 0.1,
        }
        try:
            response = client.chat.completions.create(
                **kwargs, response_format={"type": "json_object"}
            )
        except Exception:
            # Some models (Ollama/LM Studio, older endpoints) reject
            # response_format — retry without structured output.
            response = client.chat.completions.create(**kwargs)

        raw = response.choices[0].message.content
        if not raw:
            raise RuntimeError("Empty LLM response")

        parsed = self._parse_json_response(raw)
        if parsed is None:
            raise RuntimeError(f"Could not parse LLM JSON response: {raw[:300]}")

        self._validate_team(parsed)
        return parsed

    def _parse_json_response(self, raw: str) -> dict | None:
        """Try multiple strategies to parse JSON from LLM output."""
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass

        cleaned = re.sub(r"```json\s*", "", raw)
        cleaned = re.sub(r"```\s*$", "", cleaned)
        cleaned = cleaned.strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        return None

    def _validate_team(self, parsed: dict) -> None:
        """Ensure the team field is one of the valid values."""
        team = parsed.get("team", "")
        if team in config.valid_teams:
            return
        team_lower = team.lower()
        for valid in config.valid_teams:
            if valid.lower() == team_lower:
                parsed["team"] = valid
                return
        mapped = config.team_map.get(team_lower, "CORE")
        logger.warning(f"LLM returned invalid team '{team}', mapped to '{mapped}'")
        parsed["team"] = mapped

    def _fallback_prediction(self, title: str, body: str, existing_labels: list[str] = None) -> dict:
        """Heuristic-based fallback when LLM is unavailable."""
        text = f"{title} {body}".lower()
        existing_labels = existing_labels or []

        is_bug = any(kw in text for kw in ["bug", "crash", "error", "broken", "fail", "unexpected"])
        is_translation = any(
            kw in text
            for kw in [
                "translation", "i18n", "locale", "language", "voiceover",
                "sign language", "caption", "subtitle",
            ]
        )
        is_perf = any(kw in text for kw in ["performance", "slow", "lag", "latency"])
        is_docs = bool(re.search(r"\bdoc(s)?\b|documentation|readme|typo", text))
        is_feature = any(kw in text for kw in ["feature", "request", "would like", "please add"])
        is_accessibility = any(kw in text for kw in ["accessibility", "a11y", "screen reader", "wcag", "aria"])
        is_ci = any(kw in text for kw in ["ci break", "ci failure", "build fail", "test fail", "pipeline", "flaky", "github action", "release"])

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

        team = "CORE"
        if is_docs or is_ci:
            team = "Developer Workflow"
        elif is_translation or is_accessibility:
            team = "LEAP"

        cuj = "Learner Experience"
        if is_translation:
            cuj = "Translation Review"

        priority = "high" if is_bug else "medium"
        severity = "major" if is_bug else "minor"

        reasons = []
        if is_bug:
            reasons.append("The issue describes a bug or error")
        if is_feature:
            reasons.append("The issue is a feature request")
        if is_translation:
            reasons.append("The issue relates to translations")
        if is_perf:
            reasons.append("The issue mentions performance concerns")
        if is_docs:
            reasons.append("The issue involves documentation")
        if is_accessibility:
            reasons.append("The issue addresses accessibility")
        if is_ci:
            reasons.append("The issue involves CI/build failures")
        if not reasons:
            reasons.append("No strong keyword signals found — defaulting to bug classification")

        explanation = "Heuristic analysis (LLM unavailable): " + ". ".join(reasons) + f". The {team} team was selected."

        signal_count = sum([is_bug, is_feature, is_translation, is_perf, is_docs, is_accessibility, is_ci])
        if signal_count >= 3:
            confidence = 55.0
        elif signal_count == 2:
            confidence = 48.0
        elif signal_count == 1:
            confidence = 42.0
        else:
            confidence = 35.0

        return {
            "labels": all_labels,
            "newLabels": new_labels,
            "team": team,
            "repository": "oppia/oppia",
            "cuj": cuj,
            "goodFirstIssue": is_bug and not is_translation,
            "priority": priority,
            "severity": severity,
            "confidenceScore": confidence,
            "explanation": explanation,
            "similarIssues": [],
            "_method": "heuristic_fallback",
        }
