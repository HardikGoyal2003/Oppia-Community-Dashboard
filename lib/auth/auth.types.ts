import { DefaultSession } from "next-auth";
import type { SchemaVersioned } from "@/lib/domain/schema.types";
import type { UserRole } from "./roles";

export type { UserRole } from "./roles";

/** Supported contribution platforms. */
export const CONTRIBUTION_PLATFORMS = ["WEB", "ANDROID"] as const;

export type ContributionPlatform = (typeof CONTRIBUTION_PLATFORMS)[number];

/**
 * Validates whether the provided value is a supported contribution platform.
 *
 * @param value The raw platform candidate.
 * @returns True when the value is a supported contribution platform.
 */
export function isContributionPlatform(
  value: string,
): value is ContributionPlatform {
  return CONTRIBUTION_PLATFORMS.some((platform) => platform === value);
}

export interface Notification extends SchemaVersioned {
  id: string;
  message: string;
  createdAt: Date;
  read: boolean;
}

export interface UserModel extends SchemaVersioned {
  email: string;
  fullName: string;
  photoURL: string;
  githubUsername: string;
  role: UserRole;
  team: string | null;
  // Selected during first login; can be changed later via a dedicated flow.
  platform: ContributionPlatform | null;
  createdAt: Date;
}

/**
 * Augment next-auth types
 */
declare module "next-auth" {
  interface Session {
    invalidUser?: boolean;
    user?: {
      id: string;
      role: UserRole;
      team: string | null;
      platform: ContributionPlatform | null;
      githubUsername: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    invalidUser?: boolean;
    userId?: string;
    role?: UserRole;
    team?: string | null;
    platform?: ContributionPlatform | null;
    githubUsername?: string;
  }
}
