import { ConsoleMailer } from '../src/infrastructure/mail/console.mailer';
import { logger } from '../src/infrastructure/logger/logger';

// The transport that exists so the app can be demonstrated without a provider
// that will accept the address. It must never reach the network, and it must
// surface the code — a log line nobody can find the code in is no use.
describe('ConsoleMailer', () => {
  const info = jest.spyOn(logger, 'info').mockImplementation(() => logger);

  afterEach(() => info.mockClear());
  afterAll(() => info.mockRestore());

  const message = {
    to: 'camila@example.com',
    subject: 'Your Persona code',
    html: '<p>Your code is <b>481920</b></p>',
    text: 'Your code is 481920. It expires in 10 minutes.',
  };

  it('pulls the code out so it can be read at a glance', async () => {
    await new ConsoleMailer().send(message);

    const [fields, line] = info.mock.calls[0];
    expect(fields).toMatchObject({ to: 'camila@example.com', code: '481920' });
    expect(line).toContain('481920');
  });

  it('still logs a message that carries no code', async () => {
    await new ConsoleMailer().send({ ...message, text: 'Welcome to Persona.' });

    const [fields, line] = info.mock.calls[0];
    expect(fields).toMatchObject({ code: undefined });
    expect(line).toContain('Your Persona code');
  });

  it('resolves without sending anything', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    await expect(new ConsoleMailer().send(message)).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
