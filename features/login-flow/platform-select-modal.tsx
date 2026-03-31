"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

type PreferredLanguage = "JS" | "PYTHON" | "JAVA" | "OTHER";

const LANGUAGE_OPTIONS: Array<{
  label: string;
  value: PreferredLanguage;
}> = [
  { label: "JavaScript", value: "JS" },
  { label: "Python", value: "PYTHON" },
  { label: "Java", value: "JAVA" },
  { label: "Not mentioned here", value: "OTHER" },
];

function getRecommendedPlatform(
  selectedLanguage: PreferredLanguage | null,
): ContributionPlatform {
  if (selectedLanguage === "JS" || selectedLanguage === "PYTHON") {
    return "WEB";
  }

  return "ANDROID";
}

function getRecommendationPoints(
  selectedLanguage: PreferredLanguage | null,
  recommendedPlatform: ContributionPlatform,
): string[] {
  if (recommendedPlatform === "WEB") {
    if (selectedLanguage === "PYTHON") {
      return [
        "A good choice if you already know Python, since Oppia's web contribution flow often touches Python as well.",
        "It can be easier to grow into the web platform when one part of the stack already feels familiar.",
        "You can build frontend knowledge gradually while still benefiting from your existing Python background.",
      ];
    }

    return [
      "Strong choice if you already know JavaScript.",
      "Your existing frontend knowledge transfers more directly to this codebase.",
      "TypeScript is usually a natural next step after JavaScript, which makes Angular easier to approach as well.",
    ];
  }

  if (selectedLanguage === "JAVA") {
    return [
      "More contributor opportunities are usually available in that repository.",
      "If you already know programming fundamentals, Kotlin is usually easier to ramp into than a full web stack.",
      "This is especially true if you already know Java, since Kotlin will feel more familiar.",
      "The web path often requires learning HTML, CSS, JavaScript, TypeScript, Angular, and some Python around the workflow.",
    ];
  }

  return [
    "More contributor opportunities are usually available in that repository.",
    "If you already know programming fundamentals, Kotlin is usually easier to ramp into than a full web stack.",
    "It is a good starting point if you want a clearer path into beginner-friendly issues.",
    "The web path often requires learning HTML, CSS, JavaScript, TypeScript, Angular, and some Python around the workflow.",
  ];
}

export function PlatformSelectModal({
  initialPlatform,
}: {
  initialPlatform: ContributionPlatform | null;
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<ContributionPlatform | null>(
    initialPlatform,
  );
  const [showGuidedSelection, setShowGuidedSelection] = useState(false);
  const [selectedLanguage, setSelectedLanguage] =
    useState<PreferredLanguage | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOpen = useMemo(() => platform === null, [platform]);
  const hasLanguageSelection = selectedLanguage !== null;
  const recommendedPlatform = useMemo(
    () => getRecommendedPlatform(selectedLanguage),
    [selectedLanguage],
  );
  const recommendationPoints = useMemo(
    () => getRecommendationPoints(selectedLanguage, recommendedPlatform),
    [recommendedPlatform, selectedLanguage],
  );

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

  function selectGuidedLanguage(language: PreferredLanguage) {
    setSelectedLanguage((currentLanguage) =>
      currentLanguage === language ? null : language,
    );
  }

  async function handleGuidedContinue() {
    await save(recommendedPlatform);
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
          <DialogTitle>
            {showGuidedSelection
              ? "We Will Help You Choose"
              : "Select Your Contribution Platform"}
          </DialogTitle>
          <DialogDescription>
            {showGuidedSelection
              ? "Select the language you know best. We will recommend the best platform to start with."
              : "Choose where you want to contribute."}
          </DialogDescription>
        </DialogHeader>

        {showGuidedSelection ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {LANGUAGE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  disabled={saving}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => selectGuidedLanguage(option.value)}
                >
                  <span>{option.label}</span>
                  {selectedLanguage === option.value && (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>

            {hasLanguageSelection && (
              <div className="rounded-md border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  Recommendation:{" "}
                  {recommendedPlatform === "WEB" ? "Web" : "Android"}
                </p>
                <ul className="list-disc space-y-1 pl-5 pt-2">
                  {recommendationPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              type="button"
              disabled={saving || !hasLanguageSelection}
              className="w-full"
              onClick={() => void handleGuidedContinue()}
            >
              {hasLanguageSelection
                ? `Continue with ${
                    recommendedPlatform === "WEB" ? "Web" : "Android"
                  }`
                : "Select at least one language"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              className="px-0"
              onClick={() => {
                setShowGuidedSelection(false);
                setSelectedLanguage(null);
                setError(null);
              }}
            >
              Back to platform selection
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
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

            <div className="flex justify-center">
              <button
                type="button"
                disabled={saving}
                className="text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => {
                  setShowGuidedSelection(true);
                  setSelectedLanguage(null);
                  setError(null);
                }}
              >
                Not sure? Help me choose
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
