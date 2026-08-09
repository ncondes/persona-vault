// The parts of the code screen that are arithmetic rather than markup, kept
// here so they can be tested without a renderer.

export const RESEND_COOLDOWN_SECONDS = 60;
export const CODE_TTL_SECONDS = 10 * 60;

// The API says when a code dies, not when it was sent, but the cooldown runs
// from the send — so work back. Pure, so it can be called during a render.
export function sentAtFrom(expiresAt: string): number {
  return new Date(expiresAt).getTime() - CODE_TTL_SECONDS * 1000;
}

// Seconds still to wait before "send a new code" does anything. The backend
// enforces the same window; this only stops the button lying about it.
export function secondsUntilResend(
  sentAt: number,
  now: number,
  cooldownSeconds = RESEND_COOLDOWN_SECONDS,
): number {
  const left = Math.ceil((sentAt + cooldownSeconds * 1000 - now) / 1000);
  return left > 0 ? left : 0;
}

// "camila@example.com" -> "c•••a@example.com". Enough to confirm the right
// address without printing it in full on a screen someone may be sharing.
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return email;

  const name = email.slice(0, at);
  const domain = email.slice(at);
  if (name.length <= 2) return `${name[0]}•••${domain}`;

  return `${name[0]}•••${name[name.length - 1]}${domain}`;
}
