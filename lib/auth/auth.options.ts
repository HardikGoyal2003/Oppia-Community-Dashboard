import GitHubProvider from "next-auth/providers/github";
import { requireEnv, readEnv } from "@/lib/config/env";
import type { JWT } from "next-auth/jwt";
import type { AuthOptions, Session } from "next-auth";
import {
  syncJwtWithUser,
  syncSessionWithUser,
  syncUserOnSignIn,
} from "./auth-sync.service";

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
    signIn: syncUserOnSignIn,
    async jwt({ token }: { token: JWT }) {
      return syncJwtWithUser(token);
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      return syncSessionWithUser(session, token);
    },
  },
};
