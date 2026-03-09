"use client";

import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace("/dashboard");
      return;
    }

    if (status === "authenticated" && !session?.user) {
      signOut({ redirect: false });
    }
  }, [status, session, router]);

  const handleSignIn = async () => {
    setLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  };

  if (status === "loading") {
    return null;
  }

  return (
    <main className="min-h-screen flex flex-col justify-around bg-linear-to-b from-slate-100 via-slate-50 to-white px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl lg:min-h-[680px] lg:flex-row">
        <section className="relative h-56 w-full overflow-hidden lg:h-auto lg:w-1/2">
          <Image
            src="/login_form_banner.png"
            alt="Oppia contributors collaborating"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/55 via-black/20 to-black/10" />
          <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-white/80">
              Oppia Community Dashboard
            </p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">
              A contribution system for every role.
            </h1>
            <p className="mt-2 max-w-md text-sm text-white/90">
              Structured onboarding for contributors and reliable coordination tools for maintainers.
            </p>
          </div>
        </section>

        <section className="flex w-full flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-10 lg:w-1/2">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900">
                Sign in
              </h2>
              <p className="mt-1 text-slate-500">
                Access your Oppia dashboard with Google.
              </p>
            </div>

            <button
              onClick={handleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-300 px-4 py-3 text-slate-700 font-medium hover:bg-slate-50 transition disabled:opacity-60"
            >
              {loading ? (
                <span className="animate-pulse">Signing you in...</span>
              ) : (
                <>
                  <Image
                    src="https://www.svgrepo.com/show/475656/google-color.svg"
                    alt="Google"
                    width={20}
                    height={20}
                  />
                  <span>Continue with Google</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>

      <SiteFooter className="mt-6 text-center text-sm text-slate-400" />
    </main>
  );
}
