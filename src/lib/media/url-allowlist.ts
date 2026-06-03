/**
 * Verifies a Cloudinary secure_url really belongs to our cloud account.
 *
 * Critical defense for /api/media/confirm — without it a logged-in attacker
 * could POST any URL (their own Cloudinary, an attacker-controlled server, …)
 * and we'd persist it under MediaAsset. Result: stored XSS / phishing / theft.
 *
 * Accepts:
 *   https://res.cloudinary.com/<cloud>/image/upload/...
 *   https://res.cloudinary.com/<cloud>/raw/upload/...   (PDFs use raw)
 *
 * Rejects everything else, including:
 *   - any non-https protocol
 *   - any host other than res.cloudinary.com
 *   - wrong cloud name (different account)
 *   - missing /image/upload or /raw/upload prefix
 *   - malformed URLs
 */
export function isOwnCloudinaryUrl(url: string, cloudName: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.host !== 'res.cloudinary.com') return false;

  // Path must start with "/<cloudName>/<image|raw>/upload/" — the path is
  // URL-normalized by the parser so embedded NULs / percent-encoded
  // separators have already been resolved.
  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 4) return false;
  if (parts[0] !== cloudName) return false;
  if (parts[1] !== 'image' && parts[1] !== 'raw') return false;
  if (parts[2] !== 'upload') return false;
  return true;
}
