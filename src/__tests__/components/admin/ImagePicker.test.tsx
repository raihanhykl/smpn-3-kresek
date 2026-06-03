import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImagePickerProvider } from '@/components/admin/media/ImagePickerProvider';
import { useImagePicker } from '@/components/admin/media/useImagePicker';
import type { PickedMedia } from '@/components/admin/media/types';

// Minimal fetch mock: route /api/media/list responses via the test harness.
function mockListResponse(items: Array<{ id: string; publicId: string; alt: string | null; filename: string; kind?: string }>) {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        items: items.map((it) => ({
          id: it.id, kind: it.kind ?? 'image', url: 'https://res.cloudinary.com/test-cloud/image/upload/' + it.publicId,
          publicId: it.publicId, alt: it.alt, filename: it.filename,
          sizeBytes: 1, mimeType: 'image/jpeg', width: null, height: null,
        })),
        nextCursor: null,
      }),
  });
}

function Harness({ onPicked, kind }: { onPicked: (m: PickedMedia | null) => void; kind?: 'image' | 'pdf' }) {
  const { open } = useImagePicker();
  return (
    <button
      type="button"
      onClick={async () => {
        const picked = await open(kind ? { kind } : undefined);
        onPicked(picked);
      }}
    >
      open
    </button>
  );
}

describe('ImagePickerProvider + useImagePicker', () => {
  beforeEach(() => {
    delete (global as unknown as { fetch?: unknown }).fetch;
  });

  it('opens the modal, lets the user pick an item, resolves the promise with the picked media', async () => {
    mockListResponse([
      { id: 'm1', publicId: 'smpn3kresek/image/abc', alt: 'Alt A', filename: 'a.jpg' },
      { id: 'm2', publicId: 'smpn3kresek/image/def', alt: null, filename: 'b.jpg' },
    ]);

    const onPicked = jest.fn<void, [PickedMedia | null]>();
    render(
      <ImagePickerProvider>
        <Harness onPicked={onPicked} />
      </ImagePickerProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(await screen.findByRole('dialog', { name: 'Pilih Foto' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Pilih' })).toHaveLength(2);
    });
    await userEvent.click(screen.getAllByRole('button', { name: 'Pilih' })[0]!);

    await waitFor(() => expect(onPicked).toHaveBeenCalledTimes(1));
    expect(onPicked.mock.calls[0]![0]).toEqual({
      publicId: 'smpn3kresek/image/abc',
      url: 'https://res.cloudinary.com/test-cloud/image/upload/smpn3kresek/image/abc',
      alt: 'Alt A',
    });
  });

  it('resolves with null when the user presses Escape', async () => {
    mockListResponse([{ id: 'm1', publicId: 'smpn3kresek/image/abc', alt: 'x', filename: 'a.jpg' }]);

    const onPicked = jest.fn<void, [PickedMedia | null]>();
    render(
      <ImagePickerProvider>
        <Harness onPicked={onPicked} />
      </ImagePickerProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onPicked).toHaveBeenCalledWith(null));
  });

  it('resolves with null when the Batal button is clicked', async () => {
    mockListResponse([{ id: 'm1', publicId: 'smpn3kresek/image/x', alt: 'x', filename: 'a.jpg' }]);
    const onPicked = jest.fn<void, [PickedMedia | null]>();
    render(
      <ImagePickerProvider>
        <Harness onPicked={onPicked} />
      </ImagePickerProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await screen.findByRole('dialog');
    await userEvent.click(screen.getByRole('button', { name: 'Batal' }));
    await waitFor(() => expect(onPicked).toHaveBeenCalledWith(null));
  });

  it('resolves a dangling promise with null when the provider unmounts mid-open', async () => {
    mockListResponse([]);
    const onPicked = jest.fn<void, [PickedMedia | null]>();
    const { unmount } = render(
      <ImagePickerProvider>
        <Harness onPicked={onPicked} />
      </ImagePickerProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await screen.findByRole('dialog');
    act(() => unmount());
    await waitFor(() => expect(onPicked).toHaveBeenCalledWith(null));
  });

  it('useImagePicker() outside the provider is a safe no-op (resolves to null)', async () => {
    const onPicked = jest.fn<void, [PickedMedia | null]>();
    render(<Harness onPicked={onPicked} />);
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => expect(onPicked).toHaveBeenCalledWith(null));
  });
});
