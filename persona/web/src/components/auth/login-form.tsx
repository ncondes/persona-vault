"use client";

import Link from "next/link";
import { useState } from "react";
import { login, verifyLogin } from "@/lib/api";
import { errorMessage } from "@/lib/error-message";
import { useStrings } from "@/lib/locale";
import { maskEmail } from "@/lib/otp";
import type { OtpChallenge } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { OtpFields, ResendCode } from "./otp-fields";

const CARD = "w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm";

export function LoginForm() {
  const t = useStrings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The password is right, but nobody is signed in yet: the session cookie
  // arrives with the code, not with this.
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setChallenge(await login(email, password));
    } catch (err) {
      setError(errorMessage(t, err));
    }
    setBusy(false);
  };

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      await verifyLogin(challenge!.challengeId, value);
      window.location.assign("/vault");
    } catch (err) {
      setError(errorMessage(t, err));
      setCode("");
      setBusy(false);
    }
  };

  if (challenge) {
    return (
      <div className={CARD}>
        <h1 className="text-2xl font-semibold tracking-tight">{t.auth.otp.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.auth.otp.lead(maskEmail(challenge.email))}
        </p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
          className="mt-7 space-y-4"
        >
          <OtpFields
            value={code}
            onChange={setCode}
            onComplete={(value) => void verify(value)}
            disabled={busy}
          />
          {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
          <Button size="xl" type="submit" className="w-full" disabled={busy || code.length < 6}>
            {t.auth.otp.verify}
          </Button>
        </form>

        <div className="mt-5">
          <ResendCode challenge={challenge} />
        </div>
        <p className="mt-2 text-center text-sm">
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={() => {
              setChallenge(null);
              setCode("");
              setError(null);
            }}
          >
            {t.auth.otp.back}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className={CARD}>
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
