import { act, renderHook } from '@testing-library/react';
import { useCountUp } from '@lib/hooks/useCountUp';

describe('useCountUp', () => {
  beforeEach(() => {
    let now = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => now);
    let frameId = 0;
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      now += 16;
      frameId += 1;
      cb(now);
      return frameId;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns 0 when start is false', () => {
    const { result } = renderHook(() => useCountUp({ target: 100, start: false }));
    expect(result.current).toBe(0);
  });

  it('reaches the target once start flips to true', () => {
    const { result, rerender } = renderHook(({ start }) => useCountUp({ target: 100, durationMs: 100, start }), {
      initialProps: { start: false },
    });
    expect(result.current).toBe(0);
    act(() => rerender({ start: true }));
    expect(result.current).toBe(100);
  });
});
