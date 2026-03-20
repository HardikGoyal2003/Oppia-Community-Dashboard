import { withAuth } from "next-auth/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isMaintenanceModeEnabled } from "@/lib/maintenance";

export default withAuth(
  function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const maintenanceModeEnabled = isMaintenanceModeEnabled();
    const token = (
      req as NextRequest & {
        nextauth?: {
          token?: { invalidUser?: boolean } | null;
        };
      }
    ).nextauth?.token;

    if (maintenanceModeEnabled) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Maintenance mode is enabled." },
          { status: 503 }
        );
      }

      if (pathname !== "/maintenance") {
        return NextResponse.redirect(
          new URL("/maintenance", req.url)
        );
      }

      return NextResponse.next();
    }

    if (pathname === "/maintenance") {
      return NextResponse.redirect(new URL("/", req.url));
    }

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
        if (
          pathname === "/" ||
          pathname === "/login" ||
          pathname === "/maintenance" ||
          pathname.startsWith("/api/")
        ) {
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
