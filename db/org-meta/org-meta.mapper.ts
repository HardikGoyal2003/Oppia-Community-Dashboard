import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";

export type CollaboratorEntry = {
  login: string;
  permission: string;
};

export type FirestoreOrgMeta = {
  orgMembers: string[];
  collaborators: CollaboratorEntry[];
  lastUpdated: Timestamp;
};

export type OrgMetaRecord = {
  orgMembers: string[];
  collaborators: CollaboratorEntry[];
  lastUpdated: Date;
};

/**
 * Validates the raw Firestore org-meta document shape.
 *
 * @param data The raw Firestore org-meta document data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreOrgMeta(
  data: FirebaseFirestore.DocumentData,
): asserts data is FirestoreOrgMeta {
  if (
    !Array.isArray(data.orgMembers) ||
    !data.orgMembers.every((m) => typeof m === "string")
  ) {
    throw new DbValidationError(
      "orgMembers",
      "orgMembers must be an array of strings.",
    );
  }

  if (!Array.isArray(data.collaborators)) {
    throw new DbValidationError(
      "collaborators",
      "collaborators must be an array.",
    );
  }

  for (const entry of data.collaborators) {
    if (typeof entry.login !== "string") {
      throw new DbValidationError(
        "collaborators.login",
        "Each collaborator entry must have a login string.",
      );
    }
    if (typeof entry.permission !== "string") {
      throw new DbValidationError(
        "collaborators.permission",
        "Each collaborator entry must have a permission string.",
      );
    }
  }

  assertTimestamp("OrgMeta", "lastUpdated", data.lastUpdated);
}

/**
 * Normalizes raw Firestore org-meta data into the app model.
 *
 * @param data The raw Firestore org-meta data.
 * @returns The normalized org-meta record.
 */
export function normalizeOrgMetaDocument(
  data: FirebaseFirestore.DocumentData,
): OrgMetaRecord {
  assertFirestoreOrgMeta(data);

  return {
    orgMembers: data.orgMembers,
    collaborators: data.collaborators,
    lastUpdated: normalizeTimestamp(data.lastUpdated),
  };
}

/**
 * Serializes an org-meta record for Firestore storage.
 *
 * @param orgMeta The org-meta record to persist.
 * @returns The Firestore-ready org-meta document.
 */
export function serializeOrgMeta(
  orgMeta: Omit<OrgMetaRecord, "lastUpdated"> & {
    lastUpdated: Date | Timestamp;
  },
): FirestoreOrgMeta {
  return {
    orgMembers: orgMeta.orgMembers,
    collaborators: orgMeta.collaborators,
    lastUpdated:
      orgMeta.lastUpdated instanceof Timestamp
        ? orgMeta.lastUpdated
        : Timestamp.fromDate(orgMeta.lastUpdated),
  };
}
