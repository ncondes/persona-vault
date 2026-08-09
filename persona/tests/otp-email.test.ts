import { renderOtpEmail } from '../src/infrastructure/mail/otp-email';

// The template is a pure function so the thing that goes in front of every new
// user can be checked, and previewed, without sending anything.
describe('otp email', () => {
  it('carries the code in the subject, the HTML and the plain text', () => {
    const mail = renderOtpEmail({ code: '048213', purpose: 'signup', firstName: 'Ada' });

    expect(mail.subject).toContain('048213');
    expect(mail.html).toContain('048213');
    expect(mail.text).toContain('048213');
    // A client that shows only the text part must still be usable.
    expect(mail.text).toContain('10 minutes');
  });

  it('greets a signer-up by name and a signer-in not at all', () => {
    const signup = renderOtpEmail({ code: '111111', purpose: 'signup', firstName: 'Ada' });
    expect(signup.html).toContain('Hi Ada,');
    expect(signup.text).toContain('Hi Ada,');
    expect(signup.subject).toContain('Confirm your email');

    const login = renderOtpEmail({ code: '222222', purpose: 'login' });
    expect(login.html).not.toContain('Hi ');
    expect(login.subject).toContain('Your sign-in code');
    expect(login.html).toContain("Confirm it's you");
  });

  it('treats a blank name as no name', () => {
    const mail = renderOtpEmail({ code: '333333', purpose: 'signup', firstName: '   ' });
    expect(mail.html).not.toContain('Hi ');
  });

  // The name is whatever was typed into the sign-up form, so it reaches the
  // template untrusted.
  it('escapes the name instead of rendering it', () => {
    const mail = renderOtpEmail({
      code: '444444',
      purpose: 'signup',
      firstName: '<script>alert(1)</script>',
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('needs no network, no stylesheet and no images', () => {
    const mail = renderOtpEmail({ code: '555555', purpose: 'login' });

    expect(mail.html).not.toMatch(/<img|<link|src=|@import/);
    // Everything is inline: a mail client that drops <style> loses nothing.
    expect(mail.html).not.toContain('<style');
  });
});
