import GitHubProvider from "next-auth/providers/github";
import { requireEnv, readEnv } from "@/lib/config/env";
import type { AuthOptions } from "next-auth";
import {
  handleAuthJwt,
  handleAuthSession,
  handleAuthSignIn,
} from "./auth-callbacks";

const DEVELOPMENT_SECRET_FALLBACK = "development-only-insecure-secret";

/**
 * Resolves the NextAuth signing secret.
 *
 * Production deployments must configure a stable secret explicitly; allowing
 * them to start without one would silently invalidate every session on restart
 * and weaken token signing. Non-production environments may omit it and fall
 * back to a clearly scoped development value.
 *
 * @returns The NextAuth signing secret.
 * @throws {LibConfigError} When NEXTAUTH_SECRET is missing in production.
 */
function resolveNextAuthSecret(): string {
  if (readEnv("NODE_ENV") === "production") {
    return requireEnv("NEXTAUTH_SECRET");
  }

  return readEnv("NEXTAUTH_SECRET") ?? DEVELOPMENT_SECRET_FALLBACK;
}

export const authOptions: AuthOptions = {
  secret: resolveNextAuthSecret(),
  session: {
    maxAge: 7 * 24 * 60 * 60,
  },

  providers: [
    GitHubProvider({
      clientId: requireEnv("GITHUB_ID"),
      clientSecret: requireEnv("GITHUB_SECRET"),
    }),
  ],

  callbacks: {
    signIn: handleAuthSignIn,
    async jwt({ token }) {
      return handleAuthJwt(token);
    },

    session({ session, token }) {
      return handleAuthSession(session, token);
    },
  },
};
