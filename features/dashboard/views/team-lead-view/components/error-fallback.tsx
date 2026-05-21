"use client";

import { AlertCircle } from "lucide-react";

export function ErrorFallback({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 bg-gradient-to-r from-red-50 to-red-50/50 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-red-900">
              Failed to load team overview
            </h2>
            <p className="mt-0.5 text-sm text-red-600">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
