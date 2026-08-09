import {
  decryptSecret,
  encryptSecret,
  generateClientSecret,
} from '../src/infrastructure/crypto/secret-box';

// Client secrets are encrypted rather than hashed because oidc-provider
// compares them in plaintext.
describe('secret box', () => {
  it('round-trips a secret', () => {
    const secret = generateClientSecret();
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('produces a different ciphertext each time', () => {
    expect(encryptSecret('same-input')).not.toBe(encryptSecret('same-input'));
  });

  it('rejects a tampered ciphertext', () => {
    const packed = encryptSecret('tamper-me');
    const raw = Buffer.from(packed, 'base64');
    raw[raw.length - 1] ^= 0xff;
    expect(() => decryptSecret(raw.toString('base64'))).toThrow();
  });

  it('generates url-safe secrets with enough entropy', () => {
    const secret = generateClientSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(secret.length).toBeGreaterThanOrEqual(43);
  });
});
