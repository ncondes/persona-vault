import { EmailMessage, Mailer } from '../../domain/interfaces/mailer';
import { logger } from '../logger/logger';

// Writes the message to the log instead of sending it, so the app can be run
// and demonstrated without a mail provider that will accept the address.
//
// This is chosen, never fallen into: `MAIL_TRANSPORT=console` has to be set,
// and config.ts refuses it in production. The original decision was that there
// must be no transport to *silently* drop into when Resend fails — an explicit
// switch that cannot be used in production keeps that intact.
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
