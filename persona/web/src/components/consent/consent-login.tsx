"use client";

import { useState } from "react";
import { ApiError, interactionLogin } from "@/lib/api";
import { t } from "@/lib/strings";
import type { LoginPrompt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { ConsentHeader } from "./consent-header";

export function ConsentLogin({ prompt }: { prompt: LoginPrompt }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { redirectTo } = await interactionLogin(prompt.uid, email, password);
      window.location.assign(redirectTo);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(t.auth.errors[code] ?? t.common.somethingWrong);
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
      <ConsentHeader client={prompt.client} subtitle={t.auth.signInLead} />
      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label={t.auth.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label={t.auth.password} htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button size="xl" type="submit" className="w-full" disabled={busy}>
          {t.auth.signIn}
        </Button>
      </form>
    </div>
  );
}
