"use client";

import { useState } from "react";
import { useErrorMessage } from "@/components/common/use-error-message";
import { interactionLogin, interactionVerify } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { maskEmail } from "@/lib/otp";
import type { LoginPrompt, OtpChallenge } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { OtpFields, ResendCode } from "@/components/auth/otp-fields";
import { ConsentHeader } from "./consent-header";
import { FormError } from "@/components/common/form-error";

const CARD = "w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm";

// Signing in on the way to an app's consent screen. It gets the same code step
// as the front door — otherwise this would be the way around it.
export function ConsentLogin({ prompt }: { prompt: LoginPrompt }) {
  const t = useStrings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useErrorMessage();
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setChallenge(await interactionLogin(prompt.uid, email, password));
    } catch (err) {
      setError(err);
    }
    setBusy(false);
  };

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const { redirectTo } = await interactionVerify(prompt.uid, challenge!.challengeId, value);
      window.location.assign(redirectTo);
    } catch (err) {
      setError(err);
      setCode("");
      setBusy(false);
    }
  };

  if (challenge) {
    return (
      <div className={CARD}>
        <ConsentHeader client={prompt.client} subtitle={t.auth.otp.lead(maskEmail(challenge.email))} />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
          className="mt-6 space-y-4"
        >
          <OtpFields
            value={code}
            onChange={setCode}
            onComplete={(value) => void verify(value)}
            disabled={busy}
          />
          {error ? <FormError className="justify-center">{error}</FormError> : null}
          <Button size="xl" type="submit" className="w-full" disabled={busy || code.length < 6}>
            {t.auth.otp.verify}
          </Button>
        </form>
        <div className="mt-5">
          <ResendCode challenge={challenge} />
        </div>
      </div>
    );
  }

  return (
    <div className={CARD}>
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
        {error ? <FormError>{error}</FormError> : null}
        <Button size="xl" type="submit" className="w-full" disabled={busy}>
          {t.auth.signIn}
        </Button>
      </form>
    </div>
  );
}
