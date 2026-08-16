"use client";

import { useEffect, useState } from "react";
import { demoSignIn, getCatalog } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { Button } from "@/components/ui/button";

// The way into a hosted copy of Persona. Signing in needs a code from an inbox,
// and the demo accounts live at example.com, where no mail provider will deliver
// — so on a demo the server hands the code back instead of sending it, and this
// offers the accounts it will do that for.
//
// It renders nothing anywhere else. The catalog says whether this copy is a
// demo, so a real deployment never shows a door it does not have.
//
// Both sign-in screens use it: the front door, and the one on the way to an
// app's consent screen. They finish differently — one lands in the vault, the
// other returns to the app that asked — so the caller is handed the challenge
// and the code, and does its own last step.
export function DemoSignIn({
  onCode,
  disabled,
}: {
  onCode: (challengeId: string, code: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const t = useStrings();
  const [accounts, setAccounts] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then((catalog) => setAccounts(catalog.demoLogin?.accounts ?? []))
      .catch(() => setAccounts([]));
  }, []);

  if (accounts.length === 0) return null;

  const start = async (email: string) => {
    setBusy(email);
    try {
      const challenge = await demoSignIn(email);
      await onCode(challenge.challengeId, challenge.code);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-5">
      <p className="text-sm font-medium">{t.auth.demo.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t.auth.demo.lead}</p>

      <div className="mt-4 space-y-2">
        {accounts.map((email) => (
          <Button
            key={email}
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled || busy !== null}
            onClick={() => void start(email)}
          >
            {t.auth.demo.signInAs(email)}
          </Button>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{t.auth.demo.note}</p>
    </div>
  );
}
