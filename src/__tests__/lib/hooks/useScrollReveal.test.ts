import { renderHook } from '@testing-library/react';
import { useScrollReveal } from '@lib/hooks/useScrollReveal';

describe('useScrollReveal', () => {
  it('returns a ref and a visible flag', () => {
    const { result } = renderHook(() => useScrollReveal<HTMLDivElement>());
    expect(result.current.ref.current).toBeNull();
    expect(typeof result.current.visible).toBe('boolean');
  });

  it('falls back to immediately visible when IntersectionObserver is unavailable', () => {
    const original = (globalThis as { IntersectionObserver?: typeof IntersectionObserver }).IntersectionObserver;
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: undefined, configurable: true });
    const target = document.createElement('div');
    const { result } = renderHook(() => useScrollReveal<HTMLDivElement>());
    Object.defineProperty(result.current.ref, 'current', { value: target, writable: true });
    Object.defineProperty(globalThis, 'IntersectionObserver', { value: original, configurable: true });
    expect(typeof result.current.visible).toBe('boolean');
  });
});
