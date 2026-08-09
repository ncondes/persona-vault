export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  // Every message carries a plain-text alternative: some clients show it, and
  // the ones that don't still rank a message better for having it.
  text: string;
}

// The one thing the backend sends out over the network. An interface because the
// service should not know or care that Resend is on the other end — and because
// tests hand the container a transport that goes nowhere.
export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}
