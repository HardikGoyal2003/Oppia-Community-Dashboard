import { Timestamp } from "firebase-admin/firestore";
import type {
  ContributionPlatform,
  UserModel,
  UserRole,
} from "@/lib/auth/auth.types";
import { normalizeTimestamp } from "../utils/timestamp.utils";

const USER_ROLES: UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "TEAM_LEAD",
  "TEAM_MEMBER",
  "CONTRIBUTOR",
];

const CONTRIBUTION_PLATFORMS: ContributionPlatform[] = ["WEB", "ANDROID"];

export type FirestoreUser = {
  email: string;
  fullName: string;
  photoURL: string;
  githubUsername: string;
  role: UserRole;
  team: string | null;
  platform: ContributionPlatform | null;
  createdAt: Timestamp;
};

/**
 * Validates the raw Firestore user document shape.
 *
 * @param user The raw Firestore user document data.
 * @returns Nothing. Throws when the user document shape is invalid.
 */
function assertFirestoreUser(
  user: FirebaseFirestore.DocumentData,
): asserts user is FirestoreUser {
  if (typeof user.email !== "string") {
    throw new Error("User email must be a string.");
  }

  if (typeof user.fullName !== "string") {
    throw new Error("User fullName must be a string.");
  }

  if (typeof user.photoURL !== "string") {
    throw new Error("User photoURL must be a string.");
  }

  if (typeof user.githubUsername !== "string") {
    throw new Error("User githubUsername must be a string.");
  }

  if (!USER_ROLES.includes(user.role)) {
    throw new Error("User role must be a valid UserRole.");
  }

  if (user.team !== null && typeof user.team !== "string") {
    throw new Error("User team must be a string or null.");
  }

  if (
    user.platform !== null &&
    !CONTRIBUTION_PLATFORMS.includes(user.platform)
  ) {
    throw new Error("User platform must be WEB, ANDROID, or null.");
  }

  if (!(user.createdAt instanceof Timestamp)) {
    throw new Error("User createdAt must be a Timestamp.");
  }
}

/**
 * Normalizes a Firestore user document into the app user model.
 *
 * @param user The raw Firestore user document.
 * @returns The normalized user model.
 */
export function normalizeUser(user: FirestoreUser): UserModel {
  return {
    email: user.email,
    fullName: user.fullName,
    photoURL: user.photoURL,
    githubUsername: user.githubUsername,
    role: user.role,
    team: user.team,
    platform: user.platform,
    createdAt: normalizeTimestamp(user.createdAt),
  };
}

/**
 * Normalizes raw Firestore user document data into the app user model.
 *
 * @param user The raw Firestore user document data.
 * @returns The normalized user model.
 */
export function normalizeUserDocument(
  user: FirebaseFirestore.DocumentData,
): UserModel {
  assertFirestoreUser(user);
  return normalizeUser(user);
}

/**
 * Serializes a user model for Firestore storage.
 *
 * @param user The normalized user model.
 * @returns The Firestore-ready user document.
 */
export function serializeUser(
  user: Omit<UserModel, "createdAt"> & { createdAt: Date | Timestamp },
): FirestoreUser {
  return {
    email: user.email,
    fullName: user.fullName,
    photoURL: user.photoURL,
    githubUsername: user.githubUsername,
    role: user.role,
    team: user.team,
    platform: user.platform,
    createdAt:
      user.createdAt instanceof Timestamp
        ? user.createdAt
        : Timestamp.fromDate(user.createdAt),
  };
}
