const base = require('./jest.config');

// Everything in one run, so coverage is measured across the unit and integration
// suites together. Neither number means much alone: most of the OIDC layer is only
// reachable through a real authorization flow, and most of the validation logic is
// only reachable without one.
//
// Needs a running, migrated and seeded database — same as `npm run test:int`.

const { collectCoverageFrom, ...shared } = base;

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'unit',
    },
    {
      ...shared,
      displayName: 'int',
      testMatch: ['**/*.int.test.ts'],
      testPathIgnorePatterns: ['/node_modules/'],
      setupFiles: ['<rootDir>/tests/int.setup.js'],
    },
  ],
  collectCoverageFrom,
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'text', 'lcov'],
  // Floors, a few points under what the suite currently reaches, so coverage can
  // only go up. Not targets: raising these by writing tests that assert nothing
  // would make the number worse, not better.
  coverageThreshold: {
    global: { statements: 90, branches: 85, functions: 92, lines: 90 },
  },
  // The integration projects share one database, so the whole run stays serial.
  maxWorkers: 1,
  forceExit: true,
};
