export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-600">
          Maintenance Mode
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          Oppia Community Dashboard is temporarily unavailable
        </h1>
        <p className="mt-4 text-base text-slate-600">
          The app is currently under maintenance. Please check back again soon.
        </p>
      </div>
    </main>
  );
}
