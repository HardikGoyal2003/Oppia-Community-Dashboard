import type { JWT } from "next-auth/jwt";
import type { Account, Profile, Session, User } from "next-auth";
import {
  syncJwtWithUser,
  syncSessionWithUser,
  syncUserOnSignIn,
} from "./auth-sync.service";

type SignInUser =
  | User
  | {
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };

type SignInParams = {
  user: SignInUser;
  account: Account | null;
  profile?: Profile;
};

/**
 * Adapts the NextAuth sign-in callback to the auth sync service boundary.
 *
 * @param params The raw NextAuth sign-in callback parameters.
 * @returns True when sign-in may proceed.
 */
export async function handleAuthSignIn(params: SignInParams): Promise<boolean> {
  return syncUserOnSignIn(params);
}

/**
 * Adapts the NextAuth JWT callback to the auth sync service boundary.
 *
 * @param token The raw NextAuth JWT token.
 * @returns The synchronized JWT payload.
 */
export async function handleAuthJwt(token: JWT): Promise<JWT> {
  return syncJwtWithUser(token);
}

/**
 * Adapts the NextAuth session callback to the auth sync service boundary.
 *
 * @param session The raw NextAuth session.
 * @param token The raw NextAuth JWT token.
 * @returns The synchronized session payload.
 */
export async function handleAuthSession(
  session: Session,
  token: JWT,
): Promise<Session> {
  return syncSessionWithUser(session, token);
}
