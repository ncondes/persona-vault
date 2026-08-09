"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStrings } from "@/lib/locale";
import { useToast } from "@/components/common/toast";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useStrings();
  const notify = useToast();
  const [busy, setBusy] = useState(false);

  // The dialog owns the failure path for every caller; each one says its own
  // thing on success, inside onConfirm. So callers must let their errors throw
  // rather than catching them, or the toast never fires.
  //
  // It stays open on failure: the retry button is already under the cursor, and
  // sonner's container outranks the overlay, so the toast is readable anyway.
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      notify.failure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t.common.cancel}
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
