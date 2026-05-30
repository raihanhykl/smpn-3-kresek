/**
 * @jest-environment node
 */
import { toCachedUrl, type CloudinaryCachedUrl } from '@/lib/media/branded-types';

describe('toCachedUrl', () => {
  it('produces a value structurally equal to the input string', () => {
    const branded = toCachedUrl('https://res.cloudinary.com/abc/image/upload/x.jpg');
    expect(branded).toBe('https://res.cloudinary.com/abc/image/upload/x.jpg');
    expect(typeof branded).toBe('string');
  });

  it('CloudinaryCachedUrl is assignable back to string for serialization', () => {
    const branded: CloudinaryCachedUrl = toCachedUrl('x');
    const serialized: string = branded; // assignment must compile
    expect(serialized).toBe('x');
  });

  it('the brand is structural — JSON round-trips preserve the value', () => {
    const branded = toCachedUrl('hello');
    const round = JSON.parse(JSON.stringify({ url: branded }));
    expect(round.url).toBe('hello');
  });
});
