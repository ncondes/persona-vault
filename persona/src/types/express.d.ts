// Set by the auth middleware once a request is authenticated.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
