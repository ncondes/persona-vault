"use client";

import Link from "next/link";
import { useState } from "react";
import { login, ApiError } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";

export function LoginForm() {
  const t = useStrings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      window.location.assign("/vault");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(t.auth.errors[code] ?? t.common.somethingWrong);
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">{t.auth.signIn}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t.auth.signInLead}</p>

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

      <p className="mt-5 text-center text-sm">
        <Link href="/signup" className="text-brand hover:underline">
          {t.auth.noAccount}
        </Link>
      </p>
    </div>
  );
}
