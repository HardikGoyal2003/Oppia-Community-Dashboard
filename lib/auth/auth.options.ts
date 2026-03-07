import GoogleProvider from "next-auth/providers/google";
import { createUserIfNotExists, getUserById } from "@/lib/db/users.service";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";
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
    async signIn({ user }: { user: User }) {
      if (!user.email) return false;

      await createUserIfNotExists(user.email, {
        email: user.email,
        fullName: user.name ?? "",
        photoURL: user.image ?? "",
        role: "CONTRIBUTOR",
        team: null,
      });

      return true;
    },

    async jwt({ token }: { token: JWT }) {
      if (!token.email) {
        token.invalidUser = true;
        return token;
      }

      const dbUser = await getUserById(token.email);

      if (!dbUser) {
        token.invalidUser = true;
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

      const dbUser = await getUserById(token.email!);

      if (dbUser) {
        session.user.role = dbUser.role as UserRole;
        session.user.team = dbUser.team ?? null;
      }

      return session;
    },
  },
};
