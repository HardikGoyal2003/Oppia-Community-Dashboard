"""
Label classifier trained on Oppia issue data.

Uses embeddings + kNN to predict labels, team, priority, severity
from historical issues. This runs locally without GPU.

The classifier:
1. Embeds the issue text
2. Finds the k most similar issues in ChromaDB
3. Aggregates their labels/votes to predict the new issue's labels
4. Computes confidence based on agreement among similar issues
"""

import json
import logging
from collections import Counter

from config import config

logger = logging.getLogger(__name__)


class LabelClassifier:
    """kNN-based label classifier using ChromaDB embeddings."""

    def __init__(self, chroma_service):
        self._chroma = chroma_service

    def predict(
        self,
        embedding: list[float],
        k: int = 15,
        min_agreement: float = 0.3,
    ) -> dict:
        """Predict labels, team, priority, severity using kNN voting.

        Args:
            embedding: The issue's embedding vector
            k: Number of similar issues to consider
            min_agreement: Minimum fraction of neighbors that must agree
                          for a label to be included

        Returns:
            dict with predicted labels, team, priority, severity, confidence
        """
        # Search for k nearest neighbors
        similar = self._chroma.search(embedding, n_results=k)

        if not similar:
            return self._empty_prediction()

        # Aggregate votes from neighbors
        label_votes = Counter()
        team_votes = Counter()
        priority_votes = Counter()
        severity_votes = Counter()
        cuj_votes = Counter()
        repo_votes = Counter()
        gfi_votes = {"yes": 0, "no": 0}

        total_weight = 0
        for issue in similar:
            meta = issue.get("metadata", {})
            distance = issue.get("distance", 1.0)
            # Weight by similarity (1 - distance for cosine)
            weight = max(0.01, 1.0 - distance)
            total_weight += weight

            # Get labels (prefer corrected_labels if available)
            labels = meta.get("corrected_labels") or meta.get("labels", [])
            if isinstance(labels, str):
                try:
                    labels = json.loads(labels)
                except (json.JSONDecodeError, TypeError):
                    labels = [labels] if labels else []
            for label in labels:
                label_votes[label] += weight

            team = meta.get("corrected_team") or meta.get("team", "")
            if team:
                team_votes[team] += weight

            priority = meta.get("priority", "")
            if priority:
                priority_votes[priority] += weight

            severity = meta.get("severity", "")
            if severity:
                severity_votes[severity] += weight

            cuj = meta.get("cuj", "")
            if cuj:
                cuj_votes[cuj] += weight

            repo = meta.get("repository", "")
            if repo:
                repo_votes[repo] += weight

            gfi = meta.get("goodFirstIssue")
            if gfi is True or gfi == "true":
                gfi_votes["yes"] += weight
            elif gfi is False or gfi == "false":
                gfi_votes["no"] += weight

        # Select labels with enough agreement
        selected_labels = []
        label_confidences = {}
        for label, votes in label_votes.most_common():
            agreement = votes / total_weight if total_weight > 0 else 0
            if agreement >= min_agreement:
                selected_labels.append(label)
                label_confidences[label] = round(agreement * 100, 1)

        if not selected_labels:
            # Fallback: take top label regardless of agreement
            if label_votes:
                top_label = label_votes.most_common(1)[0][0]
                selected_labels = [top_label]

        # Select top vote for categorical fields
        team = team_votes.most_common(1)[0][0] if team_votes else "CORE"
        priority = priority_votes.most_common(1)[0][0] if priority_votes else "medium"
        severity = severity_votes.most_common(1)[0][0] if severity_votes else "minor"
        cuj = cuj_votes.most_common(1)[0][0] if cuj_votes else "Learner Experience"
        repo = repo_votes.most_common(1)[0][0] if repo_votes else "oppia/oppia"
        gfi = gfi_votes["yes"] > gfi_votes["no"] if (gfi_votes["yes"] + gfi_votes["no"]) > 0 else False

        # Compute overall confidence
        # Based on: number of neighbors, agreement level, distance
        avg_distance = sum(s["distance"] for s in similar) / len(similar)
        top_label_agreement = (
            label_votes.most_common(1)[0][1] / total_weight
            if total_weight > 0 and label_votes
            else 0
        )
        confidence = self._compute_confidence(
            k_neighbors=len(similar),
            avg_distance=avg_distance,
            top_label_agreement=top_label_agreement,
        )

        return {
            "labels": selected_labels,
            "team": team,
            "repository": repo,
            "cuj": cuj,
            "goodFirstIssue": gfi,
            "priority": priority,
            "severity": severity,
            "confidenceScore": confidence,
            "labelConfidences": label_confidences,
            "similarIssues": [
                {
                    "number": s["number"],
                    "title": s["title"],
                    "score": round((1 - s["distance"]) * 100, 1),
                    # Include neighbor labels so explanations can reference them.
                    "labels": self._get_labels(s.get("metadata", {})),
                }
                for s in similar[:5]
            ],
            "_method": "knn_classifier",
        }

    @staticmethod
    def _get_labels(meta: dict) -> list[str]:
        """Extract labels (preferring reviewer-corrected ones) from metadata."""
        labels = meta.get("corrected_labels") or meta.get("labels", [])
        if isinstance(labels, str):
            try:
                labels = json.loads(labels)
            except (json.JSONDecodeError, TypeError):
                labels = [labels] if labels else []
        return labels if isinstance(labels, list) else []

    def _compute_confidence(
        self,
        k_neighbors: int,
        avg_distance: float,
        top_label_agreement: float,
    ) -> float:
        """Compute confidence score based on multiple signals."""
        # More neighbors = higher confidence (up to a point)
        neighbor_score = min(k_neighbors / 10, 1.0) * 30  # max 30 points

        # Closer neighbors = higher confidence
        proximity_score = max(0, (1 - avg_distance)) * 30  # max 30 points

        # Higher agreement = higher confidence
        agreement_score = top_label_agreement * 40  # max 40 points

        total = neighbor_score + proximity_score + agreement_score
        return round(min(total, 99), 1)

    def _empty_prediction(self) -> dict:
        return {
            "labels": ["bug"],
            "team": "CORE",
            "repository": "oppia/oppia",
            "cuj": "Learner Experience",
            "goodFirstIssue": False,
            "priority": "medium",
            "severity": "minor",
            "confidenceScore": 50.0,
            "labelConfidences": {},
            "similarIssues": [],
            "_method": "fallback",
        }
