"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function JourneyManualCompletionDialog({
  itemLabel,
  onConfirm,
  onOpenChange,
  open,
}: {
  itemLabel: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-200 bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-950">
            Confirm Step Completion
          </DialogTitle>
          <DialogDescription className="leading-6 text-slate-600">
            {itemLabel ?? "This step will be marked as completed."}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
          This step will be marked as completed and this action is irreversible.
          Only confirm once you are sure you have actually finished it.
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-slate-900 text-white hover:bg-slate-800"
            onClick={onConfirm}
          >
            Mark As Completed
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
