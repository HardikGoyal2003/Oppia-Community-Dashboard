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

export function DeclineRequestModal({
  open,
  loading,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  loading: boolean;
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
          <DialogTitle>Decline Request</DialogTitle>
          <DialogDescription>
            Add a reason for declining this request. This message will be sent as a notification to the user.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Provide a clear reason for declining..."
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
            Submit Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
