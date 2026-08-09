const send = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send } })),
}));

import { Resend } from 'resend';
import { ResendMailer } from '../src/infrastructure/mail/resend.mailer';

// The one place the backend talks to anything outside itself. Resend is mocked
// because the point is the shape of the call and what happens when it goes
// wrong, not that the network works.
describe('ResendMailer', () => {
  const message = {
    to: 'ada@example.com',
    subject: '048213 — Confirm your email',
    html: '<p>048213</p>',
    text: '048213',
  };

  beforeEach(() => {
    send.mockReset();
    (Resend as unknown as jest.Mock).mockClear();
  });

  it('sends the message from the configured address', async () => {
    send.mockResolvedValue({ data: { id: 'msg-1' }, error: null });

    await new ResendMailer('re_test_key', 'Persona <hello@example.com>').send(message);

    expect(Resend).toHaveBeenCalledWith('re_test_key');
    expect(send).toHaveBeenCalledWith({ from: 'Persona <hello@example.com>', ...message });
  });

  // Resend reports failures in the body rather than by rejecting, so a mailer
  // that only caught throws would report success on every bounce.
  it('throws when Resend reports a failure in the response', async () => {
    send.mockResolvedValue({
      data: null,
      error: { name: 'validation_error', message: 'domain is not verified' },
    });

    await expect(
      new ResendMailer('re_test_key', 'Persona <hello@example.com>').send(message),
    ).rejects.toThrow('domain is not verified');
  });

  it('lets a network failure through', async () => {
    send.mockRejectedValue(new Error('socket hang up'));

    await expect(
      new ResendMailer('re_test_key', 'Persona <hello@example.com>').send(message),
    ).rejects.toThrow('socket hang up');
  });
});
