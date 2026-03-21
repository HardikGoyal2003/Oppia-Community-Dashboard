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
    await signIn("github", { callbackUrl: "/dashboard" });
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
              Structured onboarding for contributors and reliable coordination
              tools for maintainers.
            </p>
          </div>
        </section>

        <section className="flex w-full flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-10 lg:w-1/2">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
              <p className="mt-1 text-slate-500">
                Access your Oppia dashboard with GitHub.
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
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 fill-slate-900"
                  >
                    <path d="M12 .5C5.649.5.5 5.649.5 12c0 5.094 3.292 9.416 7.86 10.94.575.106.785-.25.785-.556 0-.274-.01-1-.016-1.963-3.197.695-3.872-1.54-3.872-1.54-.523-1.33-1.277-1.684-1.277-1.684-1.044-.714.079-.699.079-.699 1.155.081 1.763 1.186 1.763 1.186 1.026 1.759 2.692 1.251 3.348.957.104-.743.401-1.251.729-1.539-2.552-.291-5.236-1.276-5.236-5.682 0-1.255.449-2.282 1.184-3.086-.119-.29-.513-1.462.112-3.048 0 0 .965-.309 3.162 1.179A10.98 10.98 0 0 1 12 6.032c.973.005 1.954.131 2.87.384 2.195-1.488 3.158-1.179 3.158-1.179.627 1.586.233 2.758.114 3.048.737.804 1.182 1.831 1.182 3.086 0 4.417-2.688 5.387-5.248 5.673.412.355.78 1.054.78 2.124 0 1.534-.014 2.772-.014 3.149 0 .309.207.668.79.555C20.21 21.412 23.5 17.092 23.5 12c0-6.351-5.149-11.5-11.5-11.5Z" />
                  </svg>
                  <span>Continue with GitHub</span>
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
