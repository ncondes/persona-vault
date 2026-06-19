/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // Resolve `.js` import specifiers (used by the generated Prisma client) to the `.ts` source.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Integration tests (*.int.test.ts) need a running database; run them with `npm run test:int`.
  testPathIgnorePatterns: ['/node_modules/', '\\.int\\.test\\.ts$'],
};
