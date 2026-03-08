"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function UserUpdateReasonModal({
  open,
  loading,
  userName,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
  userName: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");

  const handleSubmit = async () => {
    const trimmedReason = reason.trim();

    if (!trimmedReason) {
      return;
    }

    await onSubmit(trimmedReason);
    setReason("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          setReason("");
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Provide Update Reason</DialogTitle>
          <DialogDescription>
            You are updating team/role for {userName}. Add a reason. This message will be sent to user notifications.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Write the reason for this update..."
          rows={4}
        />

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason.trim() || loading}
          >
            Submit Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
