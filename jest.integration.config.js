const nextJest = require('next/jest.js');
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.integration.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
  },
  testMatch: ['<rootDir>/src/__tests__/integration/**/*.test.{ts,tsx}'],
  testTimeout: 15000,
};

// next/jest sets transformIgnorePatterns that excludes all of node_modules.
// We need to allow ESM-only packages (next-auth, @auth/core, jose, oauth4webapi,
// preact, @panva/hkdf, and the @t3-oss env packages) through SWC so we can
// import authConfig directly in integration tests.
module.exports = async () => {
  const baseConfig = await createJestConfig(config)();
  return {
    ...baseConfig,
    transformIgnorePatterns: [
      '/node_modules/(?!(next-auth|@auth/core|jose|oauth4webapi|preact|preact-render-to-string|@panva/hkdf|@t3-oss/env-nextjs|@t3-oss/env-core)/)',
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  };
};
