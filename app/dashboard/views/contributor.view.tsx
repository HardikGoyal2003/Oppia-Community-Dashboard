"use client";

export default function ContributorView({
  message = "Thanks for signing up! You’ll get access once you’re assigned to a team."
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="max-w-xl rounded-lg border bg-white p-6 text-center shadow-sm">
        <h1 className="mb-2 text-xl font-semibold">
          Welcome to Oppia Leads Dashboard 👋
        </h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
