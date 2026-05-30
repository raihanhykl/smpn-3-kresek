// Phase 3: env stubs MUST land before any module load that may transitively
// pull src/lib/env.ts (the t3-env validator). Jest hoists `jest.mock` calls,
// but top-level `process.env.*` assignments still run before module resolution
// kicks in for the test files. Use `??=` so a real value from the shell wins.
//
// Pre-Phase-3 unit tests never imported @/lib/env, so AUTH_SECRET/AUTH_URL stubs
// weren't needed here. The new cldUrl wrapper does import env, so we land both
// auth + Cloudinary placeholders together to keep all unit suites runnable in
// isolation regardless of DATABASE_URL being unset.
process.env.AUTH_SECRET ??= 'test-secret-must-be-at-least-thirty-two-chars';
process.env.AUTH_URL ??= 'http://localhost:3000';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/unit-only-not-used';
process.env.CLOUDINARY_API_KEY ??= 'test-key';
process.env.CLOUDINARY_API_SECRET ??= 'test-secret';
process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ??= 'test-cloud';

import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

// jsdom does not provide TextEncoder/TextDecoder globals, which next/cache and
// other Next.js server modules require at import time. Polyfill from node:util.
if (typeof globalThis.TextEncoder === 'undefined') {
  (globalThis as unknown as { TextEncoder: typeof TextEncoder }).TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  (globalThis as unknown as { TextDecoder: typeof TextDecoder }).TextDecoder =
    TextDecoder as unknown as typeof globalThis.TextDecoder;
}

class MockIntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

(globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
  MockIntersectionObserver as unknown as typeof IntersectionObserver;

if (typeof window !== 'undefined' && !('scrollTo' in window)) {
  Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });
}

jest.mock('next/font/google', () => ({
  Plus_Jakarta_Sans: () => ({ variable: '--font-jakarta', className: 'font-jakarta' }),
  Inter: () => ({ variable: '--font-inter', className: 'font-inter' }),
}));

// next/cache pulls in Next.js server internals (Request, Response, streams)
// that aren't available in jsdom. Repositories that use unstable_cache/
// revalidateTag work in production and are covered by integration tests; unit
// tests only need the wrappers to be no-ops.
jest.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}));
