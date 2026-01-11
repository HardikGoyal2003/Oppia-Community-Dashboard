import GoogleProvider from "next-auth/providers/google";
import { createUserIfNotExists, getUserById } from "@/lib/db/users.service";
import { UserRole } from "./auth.types";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";

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
        email: user.email!,
        fullName: user.name!,
        photoURL: user.image!,
        role: "CONTRIBUTOR",
        team: null,
      });

      return true;
    },

    async session({ session, token }: {
      session: Session;
      token: JWT;
    }) {
      const dbUser = await getUserById(token.email!);

      if (dbUser) {
        session.user.role = dbUser.role as UserRole;
        session.user.team = dbUser.team ?? null;
        session.user.isNewUser =
          Date.now() - dbUser.createdAt.getTime() < 1000 * 60 * 5
      }

      return session;
    },
  },
};
