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
import { CopyField } from "@/components/console/copy-field";
import { useStrings } from "@/lib/locale";

// Shown once, when an app is created or its secret rotated. Persona keeps the
// secret encrypted and cannot show it again.
export function SecretDialog({
  secret,
  onClose,
}: {
  secret: string | null;
  onClose: () => void;
}) {
  const t = useStrings();

  return (
    <Dialog open={secret !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.console.credentials.revealTitle}</DialogTitle>
          <DialogDescription>{t.console.credentials.revealBody}</DialogDescription>
        </DialogHeader>
        {secret ? <CopyField value={secret} /> : null}
        <DialogFooter>
          <Button onClick={onClose}>{t.console.credentials.revealDone}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
