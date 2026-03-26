import GitHubProvider from "next-auth/providers/github";
import { requireEnv, readEnv } from "@/lib/config/env";
import type { AuthOptions } from "next-auth";
import {
  handleAuthJwt,
  handleAuthSession,
  handleAuthSignIn,
} from "./auth-callbacks";

export const authOptions: AuthOptions = {
  secret: readEnv("NEXTAUTH_SECRET"),
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

    async session({ session, token }) {
      return handleAuthSession(session, token);
    },
  },
};
