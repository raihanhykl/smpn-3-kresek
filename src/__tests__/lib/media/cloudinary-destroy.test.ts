import { destroyCloudinaryAsset } from '@/lib/media/cloudinary-destroy';

// jest sets NODE_ENV='test', so the helper returns 'destroyed' via the stub gate
// without any network call.
describe('destroyCloudinaryAsset (test gate)', () => {
  it('returns "destroyed" for an image without hitting the network', async () => {
    await expect(destroyCloudinaryAsset('smpn3kresek/image/x', 'image')).resolves.toBe('destroyed');
  });

  it('returns "destroyed" for a raw/pdf publicId', async () => {
    await expect(destroyCloudinaryAsset('smpn3kresek/pdf/x.pdf', 'raw')).resolves.toBe('destroyed');
  });
});
