import '@testing-library/jest-dom';

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

if (!('scrollTo' in window)) {
  Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });
}

jest.mock('next/font/google', () => ({
  Plus_Jakarta_Sans: () => ({ variable: '--font-jakarta', className: 'font-jakarta' }),
  Inter: () => ({ variable: '--font-inter', className: 'font-inter' }),
}));
