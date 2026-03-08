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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { CONSTANTS } from "@/lib/contants";
import { useState } from "react";
import { submitMemberAccessRequestAction } from "../../../dashboard.action";

export default function MemberRequestAccessModal() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username")!.toString() ;
    const team = formData.get("team")!.toString();
    const role = formData.get("role")!.toString();
    const note = formData.get("notes")?.toString() ?? "";

    try {
      await submitMemberAccessRequestAction({
        username,
        team,
        role,
        note,
      });
      setIsSubmitted(true);
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
    <Dialog>
      <DialogTrigger asChild>
        <Button className="inline-flex h-10 text-base rounded-md border border-blue-600 bg-white px-5 py-2 text-blue-600 font-medium hover:bg-blue-50 transition">
          Request Team Access
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        {isSubmitted ? (
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold mb-2">Request Submitted ✅</h2>
            <p className="text-gray-600">
              Thank you! Your request has been submitted. Our team will review it and get back to you soon.
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
                    {Object.entries(CONSTANTS.WEB_TEAMS).map(([key, label]) => (
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
                      .filter(([, label]) => label !== CONSTANTS.ROLES.CONTRIBUTOR)
                      .map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <Label htmlFor="github">GitHub username</Label>
                <Input
                  id="github"
                  name="username"
                  placeholder="e.g. oppiaUser201"
                  required
                />
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
