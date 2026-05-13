import { act, renderHook } from '@testing-library/react';
import { useScrollY } from '@lib/hooks/useScrollY';

describe('useScrollY', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  it('returns false when scrollY is below the threshold', () => {
    const { result } = renderHook(() => useScrollY(100));
    expect(result.current).toBe(false);
  });

  it('returns true once scrollY crosses the threshold', () => {
    const { result } = renderHook(() => useScrollY(100));
    act(() => {
      Object.defineProperty(window, 'scrollY', { value: 150, writable: true, configurable: true });
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current).toBe(true);
  });
});
