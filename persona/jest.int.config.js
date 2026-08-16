const base = require('./jest.config');

/** @type {import('jest').Config} */
module.exports = {
  ...base,
  // Only the integration tests, which require a running database.
  testMatch: ['**/*.int.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Integration tests share one database, so run them serially for determinism.
  maxWorkers: 1,
  forceExit: true,
  setupFiles: ['<rootDir>/tests/int.setup.js'],
  // Runs after the framework is installed, so it can register an afterAll.
  // Keeps one listening server per app; see the file for why.
  setupFilesAfterEnv: ['<rootDir>/tests/support/reuse-servers.js'],
};
