import { buildContainer, Container } from '../../src/container';
import { NullMailer } from './otp';

// Integration tests build the real container against the real database. The one
// thing it must not be given is a working way to send email — so the mailer is
// swapped here rather than the app growing a test-aware branch.
//
// The stub is reachable as `container.mailer` for the tests that want to look at
// what would have gone out.
export function testContainer(): Container {
  return buildContainer({ mailer: new NullMailer() });
}
