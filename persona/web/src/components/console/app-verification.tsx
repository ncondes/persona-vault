"use client";

import { useState } from "react";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { checkVerification, startVerification } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import type { AppView, VerificationChallenge } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/common/toast";
import { CopyField } from "@/components/console/copy-field";

// Domain verification, from the developer's side. Two steps, because the file
// has to go up in between.
//
// The copy is careful about what it claims. Proving a domain proves control of
// a web server and nothing else, and the consent screen says as much — so the
// console should not let a developer believe they have been vetted.
export function AppVerification({
  app,
  onChanged,
}: {
  app: AppView;
  onChanged: (next: AppView) => void;
}) {
  const t = useStrings();
  const notify = useToast();
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setReason(null);
    try {
      setChallenge(await startVerification(app.id));
    } catch (err) {
      notify.failure(err);
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);
    setReason(null);
    try {
      const result = await checkVerification(app.id);
      if (result.verified) {
        setChallenge(null);
        onChanged({ ...app, verifiedDomain: result.domain, verifiedAt: new Date().toISOString() });
        notify.success(t.console.verification.succeeded(result.domain));
      } else {
        setReason(result.reason ?? "");
      }
    } catch (err) {
      notify.failure(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        {app.verifiedDomain ? (
          <div className="flex items-center gap-2 text-[14.5px] font-medium">
            <BadgeCheck className="text-brand size-4" />
            {t.console.verification.verified(app.verifiedDomain)}
          </div>
        ) : (
          <div className="text-sensitive flex items-center gap-2 text-[14.5px] font-medium">
            <ShieldAlert className="size-4" />
            {t.console.verification.unverified}
          </div>
        )}

        <p className="text-[12.5px] text-muted-foreground">
          {app.verifiedDomain ? t.console.verification.movedWarning : t.console.verification.hint}
        </p>

        {challenge ? (
          <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4">
            <div>
              <p className="mb-2 text-[13px] font-medium">{t.console.verification.serveAt}</p>
              <CopyField value={challenge.url} />
            </div>
            <div>
              <p className="mb-2 text-[13px] font-medium">{t.console.verification.tokenLabel}</p>
              <CopyField value={challenge.token} />
            </div>
          </div>
        ) : null}

        {reason ? (
          <p className="text-sensitive text-[12.5px]">{t.console.verification.failed(reason)}</p>
        ) : null}

        {app.verifiedDomain ? null : (
          <div className="flex items-center gap-2 border-t border-zinc-100 pt-4">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void start()}>
              {t.console.verification.start}
            </Button>
            {challenge ? (
              <Button type="button" disabled={busy} onClick={() => void check()}>
                {busy ? t.console.verification.checking : t.console.verification.recheck}
              </Button>
            ) : null}
          </div>
        )}

        <p className="border-t border-zinc-100 pt-4 text-[12.5px] text-muted-foreground">
          {t.console.verification.limits}
        </p>
      </CardContent>
    </Card>
  );
}
