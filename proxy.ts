import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";

export default withAuth(
  function middleware(req: NextRequest) {
    // optional: role-based routing can go here
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow public pages
        if (req.nextUrl.pathname.startsWith("/login")) {
          return true;
        }

        // Protect dashboard
        if (req.nextUrl.pathname.startsWith("/dashboard")) {
          return !!token;
        }

        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*"],
};
