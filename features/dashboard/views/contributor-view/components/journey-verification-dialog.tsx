"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function JourneyVerificationDialog({
  activeVerificationDialog,
  firstIssueLink,
  firstPrLink,
  message,
  onOpenChange,
  secondPrLink,
  status,
}: {
  activeVerificationDialog:
    | "first_issue_claim"
    | "first_pr_merge"
    | "second_pr_merge"
    | null;
  firstIssueLink: string | null;
  firstPrLink: string | null;
  message: string | null;
  onOpenChange: (open: boolean) => void;
  secondPrLink: string | null;
  status: "error" | "loading" | "not_verified" | "verified" | null;
}) {
  const title =
    activeVerificationDialog === "first_issue_claim"
      ? status === "loading"
        ? "Checking Your First Issue Claim"
        : status === "verified"
          ? "First Issue Claim Verified"
          : status === "not_verified"
            ? "Issue Claim Not Verified Yet"
            : status === "error"
              ? "Issue Claim Verification Failed"
              : "Issue Claim Verification"
      : activeVerificationDialog === "first_pr_merge"
        ? status === "loading"
          ? "Checking Your First Merged PR"
          : status === "verified"
            ? "First PR Merge Verified"
            : status === "not_verified"
              ? "First PR Not Verified Yet"
              : status === "error"
                ? "First PR Verification Failed"
                : "First PR Verification"
        : activeVerificationDialog === "second_pr_merge"
          ? status === "loading"
            ? "Checking Your Second Merged PR"
            : status === "verified"
              ? "Second PR Merge Verified"
              : status === "not_verified"
                ? "Second PR Not Verified Yet"
                : status === "error"
                  ? "Second PR Verification Failed"
                  : "Second PR Verification"
          : "Verification";

  const description =
    activeVerificationDialog === "first_issue_claim"
      ? "This verifies whether your first issue was actually claimed by you."
      : activeVerificationDialog === "first_pr_merge"
        ? "This verifies whether your first pull request was actually merged."
        : "This verifies whether your second pull request was actually merged.";

  return (
    <Dialog
      open={activeVerificationDialog !== null}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="border-slate-200 bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-950">{title}</DialogTitle>
          <DialogDescription className="leading-6 text-slate-600">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div
          className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
            status === "verified"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : status === "not_verified"
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : status === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {status === "loading"
            ? "Verification is running against GitHub now."
            : (message ?? "No verification message available.")}
        </div>
        <DialogFooter showCloseButton>
          {activeVerificationDialog === "first_issue_claim" &&
            firstIssueLink && (
              <Button asChild>
                <a href={firstIssueLink} target="_blank" rel="noreferrer">
                  Open Issue Link
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
          {activeVerificationDialog === "first_pr_merge" && firstPrLink && (
            <Button asChild>
              <a href={firstPrLink} target="_blank" rel="noreferrer">
                Open PR Link
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
          {activeVerificationDialog === "second_pr_merge" && secondPrLink && (
            <Button asChild>
              <a href={secondPrLink} target="_blank" rel="noreferrer">
                Open Second PR Link
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
