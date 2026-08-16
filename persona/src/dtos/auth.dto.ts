import { z } from 'zod';
import { OTP_LENGTH } from '../constants/otp';

export const registerSchema = z.object({
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  email: z.string().email(),
  // Named, because "this is a bit short" is not what a person needs to hear
  // about a password — they need the number.
  password: z.string().min(8, { error: 'PASSWORD_TOO_SHORT' }),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// The development-only sign-in helper takes just the address; its route is not
// mounted in production.
export const devLoginSchema = z.object({
  email: z.string().email(),
});

// The code is digits only, so anything else is rejected before a lookup happens
// and never costs the caller one of its five attempts.
export const verifySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), { error: 'INVALID_CODE' }),
});

export const resendSchema = z.object({
  challengeId: z.string().min(1),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type DevLoginDto = z.infer<typeof devLoginSchema>;
export type VerifyDto = z.infer<typeof verifySchema>;
export type ResendDto = z.infer<typeof resendSchema>;
