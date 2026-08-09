import { Resend } from 'resend';
import { EmailMessage, Mailer } from '../../domain/interfaces/mailer';

// The only outbound call the backend makes. Resend reports failures in the
// response body rather than by rejecting, so both shapes are turned into a
// throw and left for the service to translate — this layer knows nothing about
// HTTP status codes.
export class ResendMailer implements Mailer {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });

    if (error) {
      throw new Error(`resend rejected the message: ${error.name} ${error.message}`);
    }
  }
}
