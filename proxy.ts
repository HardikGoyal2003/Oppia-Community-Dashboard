import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = (
      req as NextRequest & {
        nextauth?: {
          token?: { invalidUser?: boolean } | null;
        };
      }
    ).nextauth?.token;

    // Valid logged-in users should not access home or login
    if (
      token &&
      !token.invalidUser &&
      (pathname === "/" || pathname === "/login")
    ) {
      return NextResponse.redirect(
        new URL("/dashboard", req.url)
      );
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Public pages: always accessible
        if (pathname === "/" || pathname === "/login") {
          return true;
        }

        // Protected routes: only valid users
        if (pathname.startsWith("/dashboard")) {
          return !!token && !token.invalidUser;
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
  matcher: ["/", "/login", "/dashboard/:path*"],
};
