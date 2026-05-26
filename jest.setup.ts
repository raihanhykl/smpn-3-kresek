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
