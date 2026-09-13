"""Repair ChromaDB team metadata for the issue triage classifier.

1. Delete unverified pending AI predictions (they pollute semantic search with
   a degenerate CORE team and will be regenerated).
2. Re-derive `team`/`corrected_team` for seeded (accepted) issues from their
   stored labels + title, mapping legacy vocabulary (Engineering/Docs) into
   LEAP | CORE | Developer Workflow.
"""
import json
import sys

sys.path.insert(0, ".")
from chroma_service import ChromaService
from classifier_service import infer_team


def load_labels(meta: dict) -> list[str]:
    raw = meta.get("labels") or meta.get("corrected_labels")
    if isinstance(raw, list):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return [raw]
    return []


def main():
    chroma = ChromaService()
    chroma.initialize()
    col = chroma.collection

    all_data = col.get(include=["metadatas", "documents"])
    ids = all_data["ids"]
    metas = all_data["metadatas"]
    docs = all_data["documents"]

    pending_ids = []
    remapped = 0
    for i, meta in enumerate(metas):
        state = meta.get("state", "")
        if state == "pending":
            pending_ids.append(ids[i])
            continue

        title = docs[i] or ""
        labels = load_labels(meta)
        team = infer_team(labels, title)
        if meta.get("team") != team or meta.get("corrected_team") != team:
            meta["team"] = team
            meta["corrected_team"] = team
            remapped += 1

    if pending_ids:
        col.delete(ids=pending_ids)
        print(f"Deleted {len(pending_ids)} pending predictions")
    else:
        print("No pending predictions to delete")

    if remapped:
        non_pending = [i for i in range(len(ids)) if ids[i] not in pending_ids]
        BATCH = 2000
        for start in range(0, len(non_pending), BATCH):
            chunk = non_pending[start : start + BATCH]
            col.update(
                ids=[ids[i] for i in chunk],
                metadatas=[metas[i] for i in chunk],
            )
        print(f"Remapped team metadata for {remapped} seeded issues")
    else:
        print("No team metadata to remap")

    print(f"Collection now has {chroma.count()} issues")


if __name__ == "__main__":
    main()