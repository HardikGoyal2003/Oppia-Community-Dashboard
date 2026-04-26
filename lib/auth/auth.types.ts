import { DefaultSession } from "next-auth";
import type { UserRole } from "./roles";

export type { UserRole } from "./roles";

export type ContributionPlatform = "WEB" | "ANDROID";

export interface Notification {
  id: string;
  message: string;
  createdAt: Date;
  read: boolean;
}

export interface UserModel {
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
    githubUsername?: string;
  }
}
