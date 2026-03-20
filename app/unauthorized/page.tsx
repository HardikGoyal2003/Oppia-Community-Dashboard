import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">
          401 Unauthorized
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          You do not have permission to access this page
        </h1>
        <p className="mt-4 text-base text-slate-600">
          This area is restricted. Please contact a super admin if you believe
          this is incorrect.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
