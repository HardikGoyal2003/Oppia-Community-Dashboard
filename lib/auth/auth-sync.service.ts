import { upsertUserOnSignIn, getUserById } from "@/db/users/users.db";
import type { JWT } from "next-auth/jwt";
import type { Account, Profile, Session, User } from "next-auth";

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
 * Creates or syncs the Firestore user record during GitHub sign-in.
 *
 * @param object The NextAuth sign-in callback parameters.
 * @returns True when sign-in may proceed, or false when required identity data is missing.
 */
export async function syncUserOnSignIn({
  user,
  account,
  profile,
}: SignInParams): Promise<boolean> {
  if (!user.email) {
    return false;
  }

  const subjectId = account?.providerAccountId;
  const githubUsername =
    profile && "login" in profile && typeof profile.login === "string"
      ? profile.login
      : null;

  if (!subjectId || !githubUsername) {
    return false;
  }

  await upsertUserOnSignIn(subjectId, {
    email: user.email,
    fullName: user.name ?? "",
    photoURL: user.image ?? "",
    githubUsername,
    role: "CONTRIBUTOR",
    team: null,
    platform: null,
  });

  return true;
}

/**
 * Hydrates a NextAuth JWT with Firestore user metadata.
 *
 * @param token The mutable JWT token from the NextAuth callback.
 * @returns The updated token payload.
 */
export async function syncJwtWithUser(token: JWT): Promise<JWT> {
  if (!token.sub) {
    token.invalidUser = true;
    return token;
  }

  token.userId = token.sub;

  const dbUser = await getUserById(token.sub);

  if (!dbUser) {
    token.invalidUser = true;
    return token;
  }

  token.invalidUser = false;
  token.role = dbUser.role;
  token.team = dbUser.team ?? null;
  token.platform = dbUser.platform ?? null;
  token.githubUsername = dbUser.githubUsername;

  return token;
}

/**
 * Hydrates the NextAuth session from the JWT, which already carries the role,
 * team, platform, and GitHub username copied over by the JWT callback. This
 * avoids a second Firestore read on every session request.
 *
 * @param session The mutable session object from the NextAuth callback.
 * @param token The JWT token that identifies the current user.
 * @returns The updated session payload.
 */
export function syncSessionWithUser(session: Session, token: JWT): Session {
  const userId = token.userId ?? token.sub;

  if (token.invalidUser || !userId || !token.role || !token.githubUsername) {
    return {
      ...session,
      invalidUser: true,
      user: undefined,
    };
  }

  return {
    ...session,
    invalidUser: false,
    user: {
      ...session.user,
      id: userId,
      role: token.role,
      team: token.team ?? null,
      platform: token.platform ?? null,
      githubUsername: token.githubUsername,
    },
  };
}
