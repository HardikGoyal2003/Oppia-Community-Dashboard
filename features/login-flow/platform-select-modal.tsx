"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

export function PlatformSelectModal({
  initialPlatform,
}: {
  initialPlatform: ContributionPlatform | null;
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<ContributionPlatform | null>(
    initialPlatform,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = useMemo(() => platform === null, [platform]);

  async function save(next: ContributionPlatform) {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/users/platform", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: next }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to update platform.");
      }

      setPlatform(next);
      // Ensure server components (and session) pick up the new platform.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        // Radix sometimes fires this on outside interactions.
        onInteractOutside={(e) => e.preventDefault()}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Select Your Contribution Platform</DialogTitle>
          <DialogDescription>
            Choose where you want to contribute.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <Button
            type="button"
            disabled={saving}
            className="w-full"
            onClick={() => save("WEB")}
          >
            Web (oppia/oppia)
          </Button>
          <Button
            type="button"
            disabled={saving}
            variant="secondary"
            className="w-full"
            onClick={() => save("ANDROID")}
          >
            Android (oppia/oppia-android)
          </Button>
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
