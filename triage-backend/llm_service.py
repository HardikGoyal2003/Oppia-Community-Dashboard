"""
LLM service for generating triage predictions.

Uses an OpenAI-compatible chat completions endpoint (default: Groq free
tier) with fallback to heuristic prediction if the API is unavailable.
The LLM is the sole predictor — it receives few-shot examples and similar
historical issues as CONTEXT, then decides labels/team/priority itself.
"""

import json
import re
import time
import logging

from config import config

try:
    import openai as openai_lib
except ImportError:
    openai_lib = None

logger = logging.getLogger(__name__)

VALID_TEAMS = config.valid_teams

TRIAGE_SYSTEM_PROMPT_TPL = """You are an expert triage assistant for the Oppia open-source project (a free online education platform).

## Labels
- Use ONLY real Oppia labels, exact spelling, from: {label_list}
- labels: the COMPLETE set of labels this issue SHOULD have (including any already on GitHub that are correct).
- newLabels: the subset NOT yet on GitHub — never repeat "Existing labels", and NEVER suggest 'triage needed'.
- Bug report → 'bug'; feature request → 'enhancement'.

## Team routing (critical)
- Developer Workflow: ALL CI/CD failures, e2e/flaky acceptance tests, build/test failures, tooling, infra, docs. A CI failure stays Developer Workflow even if it touches a learner feature (e.g. a flaky voiceover acceptance test).
- LEAP: translations/voiceovers, accessibility (a11y, screen readers, WCAG), community/GSoC, localization, product strategy.
- CORE: everything else — features, bug fixes, UX, performance, lesson player, creator dashboard, classroom, contributor workflow.

Routing examples:
- "[Acceptance CI Failure] Acceptance (...) 1200000 m/s exceeded" → Developer Workflow, labels: ["bug", "CI breakage", "Flake: Acceptance"]
- "Screen readers can't navigate the dashboard (WCAG)" → LEAP, labels: ["bug", "a11y", "accessibility"]

## Response format
Respond with ONLY valid JSON:
{{"labels": string[], "newLabels": string[], "team": one of {team_list}, "repository": "oppia/oppia", "cuj": one of Learner Experience, Creator Experience, Translation Review, Community Management, Infrastructure, Onboarding, None, "goodFirstIssue": bool, "priority": critical|high|medium|low, "severity": blocker|major|minor|trivial, "confidenceScore": 0-100, "explanation": string (2-3 sentences)}}
No other text."""

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
            body=body[:1400],
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
            "max_tokens": 384,
            "temperature": 0.1,
        }

        # Retry on rate limits (429) and transient 5xx errors with backoff —
        # free-tier Groq quotas are tight and reset on a rolling window, so a
        # run must pause and wait rather than silently fall back to heuristics.
        attempts = 0
        last_err: Exception | None = None
        for attempt in range(1, 11):
            attempts = attempt
            try:
                response = client.chat.completions.create(
                    **kwargs, response_format={"type": "json_object"}
                )
                break
            except Exception:
                # Some models (Ollama/LM Studio, older endpoints) reject
                # response_format — retry without structured output.
                try:
                    response = client.chat.completions.create(**kwargs)
                    break
                except Exception as e:
                    last_err = e
                    if not self._is_retryable(e):
                        raise
                    retry_after = self._retry_after_seconds(e)
                    delay = retry_after or min(90, 10 * 2 ** (attempt - 1))
                    logger.warning(
                        f"LLM rate limit/backoff (attempt {attempt}), "
                        f"waiting {delay:.0f}s: {str(e)[:120]}"
                    )
                    time.sleep(delay)
        else:
            raise RuntimeError(
                f"LLM rate limit persisted after {attempts} attempts: "
                f"{str(last_err)[:200]}"
            )

        raw = response.choices[0].message.content
        if not raw:
            raise RuntimeError("Empty LLM response")

        parsed = self._parse_json_response(raw)
        if parsed is None:
            raise RuntimeError(f"Could not parse LLM JSON response: {raw[:300]}")

        self._validate_team(parsed)
        parsed["_method"] = "llm"
        return parsed

    def _is_retryable(self, e: Exception) -> bool:
        """True if the LLM error is a transient rate limit / 5xx."""
        text = str(e)
        if "429" in text or "rate_limit" in text.lower() or "too many requests" in text.lower():
            return True
        if "tokens per day" in text.lower() or "TPD" in text.upper():
            return True
        if "500" in text or "502" in text or "503" in text or "529" in text:
            return True
        if isinstance(e, (ConnectionError, TimeoutError)):
            return True
        if openai_lib is not None:
            from openai import APIStatusError, APITimeoutError, APIConnectionError, RateLimitError
            if isinstance(e, (RateLimitError, APIStatusError, APIConnectionError, APITimeoutError)):
                return True
        return False

    def _retry_after_seconds(self, e: Exception) -> float | None:
        """Extract the Retry-After hint from the rate-limit error if present."""
        match = re.search(r"try again in (\d+(?:\.\d+)?)(?:\s*s(?:econds?)?)?", str(e))
        if match:
            return float(match.group(1))
        return None

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
