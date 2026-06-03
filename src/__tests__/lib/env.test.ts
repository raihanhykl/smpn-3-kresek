/**
 * @jest-environment node
 */

describe('env validation', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
  });

  it('throws when DATABASE_URL is missing', () => {
    process.env = { ...originalEnv, DATABASE_URL: undefined };
    expect(() => {
      jest.isolateModules(() => {
        require('@/lib/env');
      });
    }).toThrow();
  });

  it('throws when AUTH_SECRET is empty', () => {
    process.env = { ...originalEnv, AUTH_SECRET: '' };
    expect(() => {
      jest.isolateModules(() => {
        require('@/lib/env');
      });
    }).toThrow();
  });

  it('exposes typed env when all vars are valid', () => {
    process.env = {
      ...originalEnv,
      DATABASE_URL: 'mysql://x:y@localhost:3306/z',
      AUTH_SECRET: 'a'.repeat(32),
      AUTH_URL: 'http://localhost:3000',
    };
    let env: unknown;
    jest.isolateModules(() => {
      env = require('@/lib/env').env;
    });
    expect(env).toMatchObject({
      DATABASE_URL: expect.stringContaining('mysql://'),
      AUTH_SECRET: expect.any(String),
    });
  });
});
