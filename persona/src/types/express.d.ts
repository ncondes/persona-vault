import 'express-session';

// The logged-in user's id, stored in the session cookie.
declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

// Set by the auth middleware once a request is authenticated.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
