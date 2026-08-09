import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderOtpEmail } from '../src/infrastructure/mail/otp-email';

// Writes both versions of the code email to disk so they can be opened in a
// browser. The unit tests check what the message says; this is for looking at
// it. Run with `npm run preview:email`.
const out = join(__dirname, '..', '.preview');
mkdirSync(out, { recursive: true });

for (const [name, input] of [
  ['signup', { code: '048213', purpose: 'signup', firstName: 'Ada' }],
  ['login', { code: '731905', purpose: 'login' }],
] as const) {
  const file = join(out, `otp-${name}.html`);
  writeFileSync(file, renderOtpEmail(input).html);
  console.log(file);
}
