import { OTP_LENGTH } from '../src/constants/otp';
import { generateOtp, hashOtp, otpMatches } from '../src/infrastructure/auth/otp';

describe('otp codes', () => {
  it('generates six digits, including ones that start with a zero', () => {
    const codes = Array.from({ length: 500 }, generateOtp);

    for (const code of codes) {
      expect(code).toMatch(/^\d{6}$/);
      expect(code).toHaveLength(OTP_LENGTH);
    }

    // Padding, not range-shifting: a code beginning 0 has to be reachable, and
    // over 500 draws the odds of seeing none are about 1 in 20,000.
    expect(codes.some((code) => code.startsWith('0'))).toBe(true);
    // The same code every time would also pass the shape check above.
    expect(new Set(codes).size).toBeGreaterThan(400);
  });

  it('hashes a code to something that is not the code', () => {
    const hash = hashOtp('123456');

    expect(hash).not.toContain('123456');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashOtp('123456')).toBe(hash);
    expect(hashOtp('123457')).not.toBe(hash);
  });

  it('matches a code against its hash and nothing else', () => {
    const hash = hashOtp('042042');

    expect(otpMatches('042042', hash)).toBe(true);
    expect(otpMatches('042043', hash)).toBe(false);
    expect(otpMatches('', hash)).toBe(false);
    // Leading zeros are part of the code, not decoration.
    expect(otpMatches('42042', hash)).toBe(false);
  });

  // timingSafeEqual throws on a length mismatch, which a truncated or garbled
  // row would cause. A wrong answer is fine here; a 500 is not.
  it('returns false rather than throwing on a malformed hash', () => {
    expect(otpMatches('123456', 'not-a-digest')).toBe(false);
    expect(otpMatches('123456', '')).toBe(false);
  });
});
