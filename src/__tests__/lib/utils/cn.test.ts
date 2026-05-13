import { cn } from '@lib/utils/cn';

describe('cn', () => {
  it('joins string arguments', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('ignores falsy values', () => {
    expect(cn('foo', false, null, undefined, 0, '', 'bar')).toBe('foo bar');
  });

  it('applies object entries when values are truthy', () => {
    expect(cn('base', { active: true, disabled: false, hover: true })).toBe('base active hover');
  });

  it('skips object entries that are null or undefined', () => {
    expect(cn('base', { a: true, b: null, c: undefined })).toBe('base a');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, undefined, null)).toBe('');
  });
});
