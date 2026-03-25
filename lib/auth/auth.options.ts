import GitHubProvider from "next-auth/providers/github";
import { createUserIfNotExists, getUserById } from "@/db/users/users.db";
import { requireEnv, readEnv } from "@/lib/config/env";
import type { JWT } from "next-auth/jwt";
import type { Account, AuthOptions, Profile, Session, User } from "next-auth";

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
    async signIn({
      user,
      account,
      profile,
    }: {
      user:
        | User
        | {
            email?: string | null;
            name?: string | null;
            image?: string | null;
          };
      account: Account | null;
      profile?: Profile;
    }) {
      if (!user.email) return false;

      const subjectId = account?.providerAccountId;
      const githubUsername =
        profile && "login" in profile && typeof profile.login === "string"
          ? profile.login
          : null;

      if (!subjectId || !githubUsername) return false;

      await createUserIfNotExists(subjectId, {
        email: user.email,
        fullName: user.name ?? "",
        photoURL: user.image ?? "",
        githubUsername,
        role: "CONTRIBUTOR",
        team: null,
        platform: null,
      });

      return true;
    },

    async jwt({ token }: { token: JWT }) {
      if (!token.sub) {
        token.invalidUser = true;
        return token;
      }

      token.userId = token.sub;

      const dbUser = await getUserById(token.sub);

      if (!dbUser) {
        token.invalidUser = true;
      } else {
        token.invalidUser = false;
        token.role = dbUser.role;
      }

      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      if (token.invalidUser) {
        return {
          ...session,
          user: undefined,
          expires: session.expires,
        };
      }

      const userId = token.userId ?? token.sub;

      if (!userId) {
        return {
          ...session,
          user: undefined,
          expires: session.expires,
        };
      }

      const dbUser = await getUserById(userId);

      if (dbUser) {
        session.user.id = userId;
        session.user.role = dbUser.role;
        session.user.team = dbUser.team ?? null;
        session.user.platform = dbUser.platform ?? null;
      }

      return session;
    },
  },
};
