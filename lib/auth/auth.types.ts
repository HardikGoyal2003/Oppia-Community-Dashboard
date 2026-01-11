import { DefaultSession } from "next-auth";

export type UserRole =
  | "TECH_LEAD"
  | "TEAM_LEAD"
  | "TEAM_MEMBER"
  | "CONTRIBUTOR";

export interface UserModel {
  email: string;
  fullName: string;
  photoURL: string;
  role: UserRole;
  team: string | null;
  createdAt: Date;
}

/**
 * Augment next-auth types
 */
declare module "next-auth" {
  interface Session {
    user: {
      role: UserRole;
      team: string | null;
      isNewUser: boolean;
    } & DefaultSession["user"];
  }
}