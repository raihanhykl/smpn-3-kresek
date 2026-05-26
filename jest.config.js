const nextJest = require('next/jest.js');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
  },
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/components/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
  coverageThreshold: {
    global: { branches: 0, functions: 0, lines: 0, statements: 0 },
    './src/lib/': { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.{ts,tsx}'],
};

// next/jest sets transformIgnorePatterns that excludes all of node_modules.
// We need to allow ESM-only packages (e.g. @t3-oss/env-*) through SWC.
module.exports = async () => {
  const baseConfig = await createJestConfig(config)();
  return {
    ...baseConfig,
    transformIgnorePatterns: [
      '/node_modules/(?!(@t3-oss/env-nextjs|@t3-oss/env-core)/)',
      '^.+\\.module\\.(css|sass|scss)$',
    ],
  };
};
