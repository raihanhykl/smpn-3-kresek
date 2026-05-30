/**
 * @jest-environment node
 */
import { isOwnCloudinaryUrl } from '@/lib/media/url-allowlist';

const CLOUD = 'mycloud';

describe('isOwnCloudinaryUrl', () => {
  it('accepts a matching https image upload URL', () => {
    expect(
      isOwnCloudinaryUrl('https://res.cloudinary.com/mycloud/image/upload/v1/smpn3kresek/image/abc.jpg', CLOUD),
    ).toBe(true);
  });

  it('accepts a matching https raw upload URL (PDFs)', () => {
    expect(
      isOwnCloudinaryUrl('https://res.cloudinary.com/mycloud/raw/upload/smpn3kresek/pdf/x.pdf', CLOUD),
    ).toBe(true);
  });

  it('rejects a different cloud name (different Cloudinary account)', () => {
    expect(
      isOwnCloudinaryUrl('https://res.cloudinary.com/attacker/image/upload/v1/foo.jpg', CLOUD),
    ).toBe(false);
  });

  it('rejects http:// (no TLS)', () => {
    expect(
      isOwnCloudinaryUrl('http://res.cloudinary.com/mycloud/image/upload/x.jpg', CLOUD),
    ).toBe(false);
  });

  it('rejects a non-Cloudinary host', () => {
    expect(
      isOwnCloudinaryUrl('https://evil.example.com/mycloud/image/upload/x.jpg', CLOUD),
    ).toBe(false);
  });

  it('rejects when /image/upload or /raw/upload prefix is missing', () => {
    expect(
      isOwnCloudinaryUrl('https://res.cloudinary.com/mycloud/foobar/upload/x.jpg', CLOUD),
    ).toBe(false);
    expect(
      isOwnCloudinaryUrl('https://res.cloudinary.com/mycloud/image/x.jpg', CLOUD),
    ).toBe(false);
  });

  it('rejects a path that tries to embed another cloud name via path traversal', () => {
    // The URL parser normalizes percent-encoded NULs and slashes so the first
    // path segment after the host is always the literal cloud name.
    expect(
      isOwnCloudinaryUrl('https://res.cloudinary.com/evil%00mycloud/image/upload/x.jpg', CLOUD),
    ).toBe(false);
  });

  it('rejects a malformed URL string', () => {
    expect(isOwnCloudinaryUrl('not a url', CLOUD)).toBe(false);
    expect(isOwnCloudinaryUrl('', CLOUD)).toBe(false);
  });
});
