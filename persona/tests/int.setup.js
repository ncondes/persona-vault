require('./env.setup');

// Integration tests exercise the built-in interaction pages, so they must not
// inherit a developer's WEB_URL redirect from .env. Setting it to an empty
// string wins over dotenv, which never overrides existing variables.
process.env.WEB_URL = '';
