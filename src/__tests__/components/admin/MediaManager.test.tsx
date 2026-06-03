import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MediaManager } from '@/app/(admin)/admin/media/MediaManager';
import type { PublicMediaAsset } from '@/lib/validation/schemas/media';
import { toCachedUrl } from '@/lib/media/branded-types';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn() }),
}));

// Mock the server actions wired into the manager.
const mockDelete = jest.fn();
const mockForceDelete = jest.fn();
jest.mock('@/app/(admin)/admin/media/_actions/media-actions', () => ({
  deleteMediaAction: (...args: unknown[]) => mockDelete(...args),
  forceDeleteMediaAction: (...args: unknown[]) => mockForceDelete(...args),
}));

function asset(id: string, overrides: Partial<PublicMediaAsset> = {}): PublicMediaAsset {
  return {
    id, kind: 'image',
    url: toCachedUrl('https://res.cloudinary.com/test-cloud/image/upload/v1/' + id + '.jpg'),
    publicId: 'smpn3kresek/image/' + id, alt: null, filename: `${id}.jpg`,
    sizeBytes: 1024, mimeType: 'image/jpeg', width: null, height: null,
    ...overrides,
  };
}

function setupFetch(
  list: PublicMediaAsset[],
  opts: { ready?: boolean } = {},
): jest.Mock {
  const ready = opts.ready ?? false;
  const fetchMock = jest.fn().mockImplementation((url: string) => {
    if (url.startsWith('/api/media/list')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ items: list, nextCursor: null }),
        status: 200,
      });
    }
    if (url.startsWith('/api/media/status')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ready }), status: 200 });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  return fetchMock;
}

describe('MediaManager', () => {
  beforeEach(() => {
    mockDelete.mockReset();
    mockForceDelete.mockReset();
    delete (global as unknown as { fetch?: unknown }).fetch;
  });

  it('shows the empty state when there are no items', async () => {
    setupFetch([]);
    render(<MediaManager role="ADMIN" />);
    await waitFor(() => expect(screen.getByText('Belum ada media.')).toBeInTheDocument());
  });

  it('renders fetched assets and toggles the filter chip', async () => {
    setupFetch([asset('a'), asset('b', { kind: 'pdf', mimeType: 'application/pdf', filename: 'doc.pdf' })]);
    render(<MediaManager role="ADMIN" />);
    await waitFor(() => expect(screen.getByText('a.jpg')).toBeInTheDocument());
    // Click "Foto" filter — triggers a new fetch with kind=image.
    await userEvent.click(screen.getByRole('button', { name: 'Foto' }));
    await waitFor(() => {
      const calls = ((global as unknown as { fetch: jest.Mock }).fetch).mock.calls;
      expect(calls.some(([u]) => String(u).includes('kind=image'))).toBe(true);
    });
  });

  it('safe delete: success path removes the row', async () => {
    setupFetch([asset('a')]);
    mockDelete.mockResolvedValue({ ok: true, data: { deleted: true } });
    render(<MediaManager role="ADMIN" />);
    await waitFor(() => expect(screen.getByText('a.jpg')).toBeInTheDocument());
    // Card-level Hapus opens the confirm dialog.
    await userEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    const input = await screen.findByRole('textbox');
    await userEvent.type(input, 'a.jpg');
    // Confirm button inside the dialog: scope by role+name="Hapus" within dialog.
    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Hapus Permanen' });
    await userEvent.click(confirmBtn);
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('a'));
  });

  it('safe delete: usage-blocked path shows the usage list modal', async () => {
    setupFetch([asset('a')]);
    mockDelete.mockResolvedValue({
      ok: true,
      data: {
        deleted: false,
        usage: [{ usedInTable: 'Teacher', usedInId: 't1', usedInField: 'photoSrc' }],
      },
    });
    render(<MediaManager role="ADMIN" />);
    await waitFor(() => expect(screen.getByText('a.jpg')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    const input = await screen.findByRole('textbox');
    await userEvent.type(input, 'a.jpg');
    const dialog = await screen.findByRole('dialog');
    const confirmBtn = within(dialog).getByRole('button', { name: 'Hapus Permanen' });
    await userEvent.click(confirmBtn);
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: 'Berkas masih dipakai' })).toBeInTheDocument(),
    );
    expect(screen.getByText(/Teacher/)).toBeInTheDocument();
  });

  it('broken-image onerror swaps to error badge; ADMIN sees Hapus catatan', async () => {
    setupFetch([asset('a')]);
    render(<MediaManager role="ADMIN" />);
    await waitFor(() => expect(screen.getByText('a.jpg')).toBeInTheDocument());
    const img = screen.getByRole('img', { name: 'a.jpg' });
    act(() => { img.dispatchEvent(new Event('error')); });
    expect(await screen.findByText('Berkas hilang di penyimpanan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hapus catatan' })).toBeInTheDocument();
  });

  it('broken row for EDITOR does not show Hapus catatan', async () => {
    setupFetch([asset('a')]);
    render(<MediaManager role="EDITOR" />);
    await waitFor(() => expect(screen.getByText('a.jpg')).toBeInTheDocument());
    const img = screen.getByRole('img', { name: 'a.jpg' });
    act(() => { img.dispatchEvent(new Event('error')); });
    expect(await screen.findByText('Berkas hilang di penyimpanan')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hapus catatan' })).not.toBeInTheDocument();
  });

  it('shows disabled "Unggah Baru" placeholder when status returns ready=false', async () => {
    setupFetch([], { ready: false });
    render(<MediaManager role="ADMIN" />);
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: 'Unggah Baru' });
      expect(btn).toBeDisabled();
    });
    // The live upload buttons are not rendered when not ready.
    expect(screen.queryByRole('button', { name: 'Unggah Foto' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Unggah PDF' })).not.toBeInTheDocument();
  });

  it('shows live "Unggah Foto" and "Unggah PDF" buttons when ready=true', async () => {
    setupFetch([], { ready: true });
    render(<MediaManager role="ADMIN" />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Unggah Foto' })).not.toBeDisabled();
    });
    expect(screen.getByRole('button', { name: 'Unggah PDF' })).not.toBeDisabled();
    // The placeholder is gone.
    expect(screen.queryByRole('button', { name: 'Unggah Baru' })).not.toBeInTheDocument();
  });
});
