// The app refuses to start without a Resend key, on purpose: there is no
// fallback transport for it to quietly drop into. Tests never send anything —
// the container is handed a stub mailer — so a placeholder is all the config
// schema needs. `||=` leaves a real key alone, and setting it here wins over
// dotenv, which never overrides an existing variable.
process.env.RESEND_API_KEY ||= 'test-resend-key';
