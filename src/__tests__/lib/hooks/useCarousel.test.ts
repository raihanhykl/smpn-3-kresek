import { act, renderHook } from '@testing-library/react';
import { useCarousel } from '@lib/hooks/useCarousel';

describe('useCarousel', () => {
  it('starts at index 0', () => {
    const { result } = renderHook(() => useCarousel({ length: 5 }));
    expect(result.current.index).toBe(0);
  });

  it('advances on next() and wraps around', () => {
    const { result } = renderHook(() => useCarousel({ length: 3 }));
    act(() => result.current.next());
    expect(result.current.index).toBe(1);
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.index).toBe(0);
  });

  it('wraps backward on prev()', () => {
    const { result } = renderHook(() => useCarousel({ length: 3 }));
    act(() => result.current.prev());
    expect(result.current.index).toBe(2);
  });

  it('goTo() ignores out-of-range indices', () => {
    const { result } = renderHook(() => useCarousel({ length: 3 }));
    act(() => result.current.goTo(2));
    expect(result.current.index).toBe(2);
    act(() => result.current.goTo(99));
    expect(result.current.index).toBe(2);
  });
});
