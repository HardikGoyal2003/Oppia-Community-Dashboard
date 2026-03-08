import { DefaultSession } from "next-auth";

export type UserRole =
  | "ADMIN"
  | "TEAM_LEAD"
  | "TEAM_MEMBER"
  | "CONTRIBUTOR";

export interface Notification {
  message: string;
  createdAt: Date;
  read: boolean;
}

export interface UserModel {
  email: string;
  fullName: string;
  photoURL: string;
  githubUsername: string | null;
  role: UserRole;
  team: string | null;
  createdAt: Date;
  notifications: Notification[];
}

/**
 * Augment next-auth types
 */
declare module "next-auth" {
  interface Session {
    user: {
      role: UserRole;
      team: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    invalidUser?: boolean;
    userId?: string;
  }
}
