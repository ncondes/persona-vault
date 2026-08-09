"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { useEffect, useRef, useState } from "react";
import { ApiError, resendCode } from "@/lib/api";
import { useStrings } from "@/lib/locale";
import { secondsUntilResend, sentAtFrom } from "@/lib/otp";
import type { OtpChallenge } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const LENGTH = 6;

interface OtpFieldsProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  disabled?: boolean;
}

// The six boxes. `onComplete` fires as soon as the last digit lands, so the
// usual path is paste-or-type and done — nobody has to reach for a button.
export function OtpFields({ value, onChange, onComplete, disabled }: OtpFieldsProps) {
  const t = useStrings();
  const input = useRef<HTMLInputElement>(null);

  // Focus on arrival, and again after a wrong code: checking one blurs the
  // field, and coming back to a cleared form you cannot type into is a dead end.
  useEffect(() => {
    if (!disabled) input.current?.focus();
  }, [disabled]);

  return (
    <InputOTP
      ref={input}
      maxLength={LENGTH}
      pattern={REGEXP_ONLY_DIGITS}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      containerClassName="justify-center"
      aria-label={t.auth.otp.label}
    >
      <InputOTPGroup>
        {Array.from({ length: LENGTH }, (_, index) => (
          <InputOTPSlot
            key={index}
            index={index}
            className="size-12 text-lg font-medium tabular-nums"
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

// The way out when the email does not arrive. The countdown mirrors the window
// the server enforces, so the button never promises something it cannot do.
export function ResendCode({ challenge }: { challenge: OtpChallenge }) {
  const t = useStrings();
  const [last, setLast] = useState(() => sentAtFrom(challenge.expiresAt));
  // Starts equal to `last` — a full cooldown — so the first paint matches on the
  // server and on the client. The ticker below takes over a second later.
  const [now, setNow] = useState(last);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [last]);

  const left = secondsUntilResend(last, now);

  const send = async () => {
    setBusy(true);
    setNote(null);
    setError(null);
    try {
      setLast(sentAtFrom((await resendCode(challenge.challengeId)).expiresAt));
      setNote(t.auth.otp.resent);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setError(t.auth.errors[code] ?? t.common.somethingWrong);
    }
    setBusy(false);
  };

  return (
    <div className="text-center">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={send}
        disabled={busy || left > 0}
      >
        {left > 0 ? t.auth.otp.resendIn(left) : t.auth.otp.resend}
      </Button>
      {note ? <p className="mt-1 text-sm text-muted-foreground">{note}</p> : null}
      {error ? <p className="mt-1 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
