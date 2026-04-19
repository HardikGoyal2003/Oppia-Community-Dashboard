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
  onOpenChange,
  secondPrLink,
}: {
  activeVerificationDialog:
    | "first_issue_claim"
    | "first_pr_merge"
    | "second_pr_merge"
    | null;
  firstIssueLink: string | null;
  firstPrLink: string | null;
  onOpenChange: (open: boolean) => void;
  secondPrLink: string | null;
}) {
  return (
    <Dialog
      open={activeVerificationDialog !== null}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="border-slate-200 bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-950">
            {activeVerificationDialog === "first_issue_claim" &&
              "Issue Claim Verification UI Ready"}
            {activeVerificationDialog === "first_pr_merge" &&
              "Merge Verification UI Ready"}
            {activeVerificationDialog === "second_pr_merge" &&
              "Second PR Verification UI Ready"}
          </DialogTitle>
          <DialogDescription className="leading-6 text-slate-600">
            {activeVerificationDialog === "first_issue_claim" &&
              "Verify whether your first issue was actually claimed by you."}
            {activeVerificationDialog === "first_pr_merge" &&
              "Verify whether your first PR has been merged."}
            {activeVerificationDialog === "second_pr_merge" &&
              "Verify whether your second PR has been merged."}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          {activeVerificationDialog === "first_issue_claim" &&
            "This is only the UI for now. The next step will be wiring this button to an issue-claim verification flow using the link you provide."}
          {activeVerificationDialog === "first_pr_merge" &&
            "This is only the UI for now. The next step will be wiring this button to a PR-merge verification flow using the link you provide."}
          {activeVerificationDialog === "second_pr_merge" &&
            "This is only the UI for now. The next step will be wiring this button to a second-PR merge verification flow using the link you provide."}
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
