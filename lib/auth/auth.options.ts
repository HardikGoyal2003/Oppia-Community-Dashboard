import GoogleProvider from "next-auth/providers/google";
import {
  createUserIfNotExists,
  getUserById,
} from "@/lib/db/users.service";
import type { JWT } from "next-auth/jwt";
import type { Account, Session, User } from "next-auth";
import { UserRole } from "./auth.types";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({
      user,
      account,
    }: {
      user: User;
      account: Account | null;
    }) {
      if (!user.email) return false;

      const subjectId = account?.providerAccountId;

      if (!subjectId) return false;

      await createUserIfNotExists(subjectId, {
        email: user.email,
        fullName: user.name ?? "",
        photoURL: user.image ?? "",
        role: "CONTRIBUTOR",
        team: null,
        notifications: [],
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
        session.user.role = dbUser.role as UserRole;
        session.user.team = dbUser.team ?? null;
      }

      return session;
    },
  },
};
