import { act, renderHook } from '@testing-library/react';
import { useAccordion } from '@lib/hooks/useAccordion';

describe('useAccordion', () => {
  it('opens an item on toggle in single mode', () => {
    const { result } = renderHook(() => useAccordion('single'));
    expect(result.current.isOpen('a')).toBe(false);
    act(() => result.current.toggle('a'));
    expect(result.current.isOpen('a')).toBe(true);
  });

  it('closes the previous item when opening another in single mode', () => {
    const { result } = renderHook(() => useAccordion('single'));
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    expect(result.current.isOpen('a')).toBe(false);
    expect(result.current.isOpen('b')).toBe(true);
  });

  it('keeps multiple items open in multi mode', () => {
    const { result } = renderHook(() => useAccordion('multi'));
    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    expect(result.current.isOpen('a')).toBe(true);
    expect(result.current.isOpen('b')).toBe(true);
    act(() => result.current.toggle('a'));
    expect(result.current.isOpen('a')).toBe(false);
  });
});
