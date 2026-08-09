import { describe, expect, it } from "vitest";
import {
  CODE_TTL_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  maskEmail,
  secondsUntilResend,
  sentAtFrom,
} from "./otp";

describe("sentAtFrom", () => {
  it("works back from the expiry the API reported", () => {
    const expiresAt = "2026-08-09T12:10:00.000Z";
    const sent = Date.parse("2026-08-09T12:00:00.000Z");

    expect(sentAtFrom(expiresAt)).toBe(sent);
  });

  // The cooldown is measured from this, so it feeds straight back in.
  it("lines up with a fresh code having its whole cooldown left", () => {
    const sent = Date.parse("2026-08-09T12:00:00.000Z");
    const expiresAt = new Date(sent + CODE_TTL_SECONDS * 1000).toISOString();

    expect(secondsUntilResend(sentAtFrom(expiresAt), sent)).toBe(RESEND_COOLDOWN_SECONDS);
  });
});

describe("secondsUntilResend", () => {
  const sentAt = 1_000_000;

  it("counts the whole cooldown down to zero", () => {
    expect(secondsUntilResend(sentAt, sentAt)).toBe(RESEND_COOLDOWN_SECONDS);
    expect(secondsUntilResend(sentAt, sentAt + 30_000)).toBe(30);
    expect(secondsUntilResend(sentAt, sentAt + 59_500)).toBe(1);
    expect(secondsUntilResend(sentAt, sentAt + 60_000)).toBe(0);
  });

  // The button should read "send a new code", not "send a new code in -4s".
  it("never goes negative once the wait is over", () => {
    expect(secondsUntilResend(sentAt, sentAt + 120_000)).toBe(0);
  });

  // Rounds up, so the button is never enabled a moment before the server
  // agrees it should be.
  it("rounds a part-second up", () => {
    expect(secondsUntilResend(sentAt, sentAt + 59_001)).toBe(1);
  });

  it("takes a different window when one is given", () => {
    expect(secondsUntilResend(sentAt, sentAt, 90)).toBe(90);
  });
});

describe("maskEmail", () => {
  it.each([
    ["camila@example.com", "c•••a@example.com"],
    ["ada@example.com", "a•••a@example.com"],
    ["jo@example.com", "j•••@example.com"],
    ["a@example.com", "a•••@example.com"],
  ])("masks %s as %s", (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });

  it("keeps a plus tag and a subdomain intact", () => {
    expect(maskEmail("nicolas+persona@mail.example.co.uk")).toBe(
      "n•••a@mail.example.co.uk",
    );
  });

  // Whatever the server said the address was, it goes on the screen. It should
  // not come back mangled.
  it("leaves something that is not an address alone", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
    expect(maskEmail("@example.com")).toBe("@example.com");
    expect(maskEmail("")).toBe("");
  });
});
