import request from 'supertest';
import { EmailMessage, Mailer } from '../../src/domain/interfaces/mailer';
import { hashOtp } from '../../src/infrastructure/auth/otp';
import { prisma } from '../../src/infrastructure/db/prisma';

export const TEST_CODE = '123456';

// Integration tests boot the real container against the real database. Without
// this they would try to reach Resend on every sign-up.
export class NullMailer implements Mailer {
  sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
  }
}

// The code exists only in an email and is stored as a digest, so tests plant one
// they know. Using the app's own hash means this cannot drift from it.
export async function forceCode(challengeId: string, code = TEST_CODE): Promise<void> {
  await prisma.otpChallenge.update({
    where: { id: challengeId },
    data: { codeHash: hashOtp(code) },
  });
}

interface Details {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

type Agent = ReturnType<typeof request.agent>;

// Sign-up is now three calls. Most suites only care that they end up with an
// account and a session, so they call this instead of spelling it out.
export async function registerVerified(agent: Agent, details: Details) {
  const started = await agent.post('/api/auth/register').send(details);
  await forceCode(started.body.data.challengeId);
  return agent
    .post('/api/auth/register/verify')
    .send({ challengeId: started.body.data.challengeId, code: TEST_CODE });
}

// The same, for signing in.
export async function loginVerified(agent: Agent, email: string, password: string) {
  const started = await agent.post('/api/auth/login').send({ email, password });
  await forceCode(started.body.data.challengeId);
  return agent
    .post('/api/auth/login/verify')
    .send({ challengeId: started.body.data.challengeId, code: TEST_CODE });
}

const AS_JSON = { Accept: 'application/json' };

// And for the consent screen's own sign-in, which is two calls now as well.
// A failed password comes straight back so the unhappy-path tests can assert on
// it; only a successful one goes on to the code.
export async function interactionLogin(
  agent: Agent,
  uid: string,
  email: string,
  password: string,
) {
  const started = await agent
    .post(`/interaction/${uid}/login`)
    .set(AS_JSON)
    .send({ email, password });
  if (started.status !== 200) return started;

  await forceCode(started.body.challengeId);
  return agent
    .post(`/interaction/${uid}/verify`)
    .set(AS_JSON)
    .send({ challengeId: started.body.challengeId, code: TEST_CODE });
}
