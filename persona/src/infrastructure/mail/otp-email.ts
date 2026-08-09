import { OTP_TTL_MS } from '../../constants/otp';
import { OtpPurpose } from '../../domain/models';
import { escapeHtml } from '../html/escape';

// The web app's tokens, copied here as literal hex because email clients get no
// stylesheet and no custom properties. Keep these in step with
// `persona/web/src/app/globals.css`.
const PAGE = '#ededec';
const CARD = '#ffffff';
const LINE = '#e4e4e7';
const INK = '#18181b';
const MUTED = '#8e8e8e';
const BRAND = '#1f6f80';
const BRAND_TINT = '#e8f3f5';

const SANS =
  "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const TTL_MINUTES = Math.round(OTP_TTL_MS / 60_000);

export interface OtpEmailInput {
  code: string;
  purpose: OtpPurpose;
  // Only a sign-up knows the name — it is being typed in the same form that
  // asked for the code. A sign-in challenge carries no name to greet.
  firstName?: string | null;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const COPY = {
  signup: {
    subject: 'Confirm your email',
    heading: 'Confirm your email',
    lead: 'Enter this code to finish creating your Persona.',
  },
  login: {
    subject: 'Your sign-in code',
    heading: "Confirm it's you",
    lead: 'Enter this code to finish signing in.',
  },
} as const;

// The mark from `web/src/components/common/logo.tsx`: a teal rounded square
// holding a white ring. Nested tables because that is the only box model every
// mail client agrees on; the corners go square in Outlook, which is fine.
const logo = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
  <td width="38" height="38" align="center" valign="middle"
      style="width:38px;height:38px;background:${BRAND};border-radius:11px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="15" height="15"
          style="width:15px;height:15px;border:2px solid ${CARD};border-radius:50%;
                 font-size:0;line-height:0;">&nbsp;</td>
    </tr></table>
  </td>
  <td style="padding-left:10px;font-family:${SANS};font-size:16px;font-weight:600;
             letter-spacing:-0.01em;color:${INK};">Persona</td>
</tr></table>`;

// The name is the only value here that came from a form, so it is the only one
// escaped. The copy is ours and the code is six generated digits; running those
// through the escaper would only turn our own apostrophes into entities.
export function renderOtpEmail({ code, purpose, firstName }: OtpEmailInput): RenderedEmail {
  const copy = COPY[purpose];
  const greeting = firstName?.trim()
    ? `<p style="margin:0 0 6px;font-family:${SANS};font-size:15px;color:${INK};">Hi ${escapeHtml(firstName.trim())},</p>`
    : '';

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${copy.subject}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};">
  <!-- Shown in the inbox list next to the subject, and nowhere else. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${code} is your Persona code. It expires in ${TTL_MINUTES} minutes.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${PAGE};padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"
             style="width:480px;max-width:100%;background:${CARD};border:1px solid ${LINE};
                    border-radius:26px;">
        <tr><td style="padding:28px;">

          ${logo}

          <h1 style="margin:26px 0 0;font-family:${SANS};font-size:24px;font-weight:600;
                     letter-spacing:-0.02em;color:${INK};">${copy.heading}</h1>
          <div style="margin-top:10px;">
            ${greeting}
            <p style="margin:0;font-family:${SANS};font-size:15px;line-height:22px;color:${MUTED};">
              ${copy.lead}
            </p>
          </div>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="margin:24px 0 0;background:${BRAND_TINT};border-radius:16px;">
            <tr><td align="center" style="padding:24px 16px;">
              <div style="font-family:${MONO};font-size:34px;font-weight:600;
                          letter-spacing:0.28em;color:${BRAND};
                          /* the tracking pads the right edge; pull it back */
                          text-indent:0.28em;">${code}</div>
            </td></tr>
          </table>

          <p style="margin:16px 0 0;font-family:${SANS};font-size:13px;color:${MUTED};">
            This code expires in ${TTL_MINUTES} minutes.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="margin:24px 0;"><tr>
            <td style="height:1px;background:${LINE};font-size:0;line-height:0;">&nbsp;</td>
          </tr></table>

          <p style="margin:0;font-family:${SANS};font-size:13px;line-height:20px;color:${MUTED};">
            If you didn't ask for this, ignore this email. The code is useless without it,
            and nothing was created or changed.
          </p>

        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    firstName?.trim() ? `Hi ${firstName.trim()},` : null,
    copy.lead,
    '',
    code,
    '',
    `This code expires in ${TTL_MINUTES} minutes.`,
    '',
    "If you didn't ask for this, ignore this email. The code is useless without it,",
    'and nothing was created or changed.',
    '',
    'Persona',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject: `${code} — ${copy.subject}`, html, text };
}
