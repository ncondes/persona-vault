import { EmailMessage, Mailer } from '../../domain/interfaces/mailer';
import { logger } from '../logger/logger';

// Writes the message to the log instead of sending it, so the app can be run
// and demonstrated without a mail provider that will accept the address.
//
// This is chosen, never fallen into: `MAIL_TRANSPORT=console` has to be set by
// name, and config.ts refuses it in production unless DEMO_LOGIN is on too —
// the public demo, where the codes are read back through the demo sign-in and
// nobody is waiting on an inbox. What that rule protects is the original
// decision: there must be no transport to *silently* drop into when Resend
// fails. Two explicit switches, both off by default, keep that intact.
export class ConsoleMailer implements Mailer {
  async send(message: EmailMessage): Promise<void> {
    // The code is the only part anyone reading the log actually wants, so pull
    // it out rather than making them find it in the plain-text body.
    const code = /\b\d{6}\b/.exec(message.text)?.[0];

    logger.info(
      { to: message.to, subject: message.subject, code },
      code
        ? `email not sent (console transport) — the code for ${message.to} is ${code}`
        : `email not sent (console transport) — "${message.subject}" for ${message.to}`,
    );
  }
}
