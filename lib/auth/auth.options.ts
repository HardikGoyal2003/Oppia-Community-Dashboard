import GitHubProvider from "next-auth/providers/github";
import {
  createUserIfNotExists,
  getUserById,
} from "@/db/users.db";
import type { JWT } from "next-auth/jwt";
import type { Profile } from "next-auth";
import type { Account, Session, User } from "next-auth";
import { UserRole } from "./auth.types";
import { ContributionPlatform } from "./auth.types";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    maxAge: 7 * 24 * 60 * 60,
  },

  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({
      user,
      account,
      profile,
    }: {
      user: User;
      account: Account | null;
      profile: Profile & { login: string };
    }) {
      if (!user.email) return false;

      const subjectId = account?.providerAccountId;
      const githubUsername = profile.login;

      if (!subjectId) return false;

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
      }

      return token;
    },

    async session({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }) {
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
        session.user.role = dbUser.role as UserRole;
        session.user.team = dbUser.team ?? null;
        session.user.platform =
          (dbUser.platform as ContributionPlatform | null) ?? null;
      }

      return session;
    },
  },
};
