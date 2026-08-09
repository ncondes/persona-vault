// How the emailed codes behave. Six digits is a million possibilities against
// five tries, so guessing one is hopeless long before the ten minutes are up.
export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

// The first send plus three resends. This is also the only thing standing
// between a script and someone else's inbox, since asking for a code again on
// an address that already has a live challenge lands here rather than sending a
// second email.
export const OTP_MAX_SENDS = 4;
