'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CONSTANTS } from "@/lib/constants";
import { useState } from "react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { formatDisplayValue } from "@/lib/utils/display-format.utils";
import { getOrdinalDay } from "@/lib/utils/date-day-format.utils";

type RequestState = "FORM" | "SUBMITTED" | "DUPLICATE";
type DuplicateRequestDetails = {
  role: string;
  team: string;
  note: string;
  createdAt: string;
};

function formatDuplicateRequestDate(createdAt: string): string {
  const date = new Date(createdAt);
  const day = getOrdinalDay(date.getDate());
  const month = date.toLocaleString("en-IN", { month: "long" });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

export default function MemberRequestAccessModal({
  platform,
}: {
  platform: ContributionPlatform;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>("FORM");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [duplicateRequest, setDuplicateRequest] =
    useState<DuplicateRequestDetails | null>(null);
  const teams =
    platform === "ANDROID" ? CONSTANTS.ANDROID_TEAMS : CONSTANTS.WEB_TEAMS;

  const resetModalState = () => {
    setRequestState("FORM");
    setLoading(false);
    setErrorMessage(null);
    setDuplicateRequest(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (!open) {
      resetModalState();
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const team = formData.get("team")!.toString();
    const role = formData.get("role")!.toString();
    const note = formData.get("notes")?.toString() ?? "";

    try {
      const response = await fetch("/api/member-access-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          team,
          role,
          note,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as {
          error?: string;
          pendingRequest?: DuplicateRequestDetails;
        };
        if (response.status === 409) {
          setDuplicateRequest(data.pendingRequest ?? null);
          setRequestState("DUPLICATE");
          return;
        }

        throw new Error(
          data.error || "Failed to submit access request."
        );
      }
      setRequestState("SUBMITTED");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to submit access request."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="inline-flex h-10 text-base rounded-md border border-blue-600 bg-white px-5 py-2 text-blue-600 font-medium hover:bg-blue-50 transition">
          Request Team Access
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {requestState === "SUBMITTED" ? (
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold mb-2">Request Submitted ✅</h2>
            <p className="text-gray-600">
              Thank you! Your request has been submitted. Our team will review it and get back to you soon.
            </p>
            <DialogClose asChild>
              <Button className="mt-6">Close</Button>
            </DialogClose>
          </div>
        ) : requestState === "DUPLICATE" ? (
          <div className="py-10 text-center">
            <h2 className="text-xl font-semibold mb-6">Request Already Pending</h2>
            <p className="text-gray-600">
              {duplicateRequest
                ? `You already have a pending team access request for ${formatDisplayValue(duplicateRequest.role)} role in ${formatDisplayValue(duplicateRequest.team)}, created at ${formatDuplicateRequestDate(duplicateRequest.createdAt)}. Thanks for your patience. Admins will review it soon.`
                : "You already have a pending team access request. Thanks for your patience. Admins will review it soon."}
            </p>
            <DialogClose asChild>
              <Button className="mt-6">Close</Button>
            </DialogClose>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Request Team Access</DialogTitle>
              <DialogDescription>
                If you are an Oppia member or collaborator, please provide the
                details below. Our team will review your request.
              </DialogDescription>
            </DialogHeader>

            <FieldGroup className="mt-4 space-y-4">
              <Field>
                <Label htmlFor="team">Team</Label>
                <Select name="team" required>
                  <SelectTrigger id="team">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(teams).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <Label htmlFor="role">Your role in Oppia</Label>
                <Select name="role" required>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONSTANTS.ROLES)
                      .filter(
                        ([key, label]) =>
                          key !== "SUPER_ADMIN" &&
                          label !== CONSTANTS.ROLES.CONTRIBUTOR
                      )
                      .map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <Label htmlFor="notes">
                  Additional notes <span className="text-gray-400">(optional)</span>
                </Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder="Anything you'd like us to know..."
                  rows={3}
                />
              </Field>
            </FieldGroup>

            {errorMessage && (
              <p className="mt-3 text-sm text-red-600">
                {errorMessage}
              </p>
            )}

            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={loading}>
                {loading ? "Submitting..." : "Submit request"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
