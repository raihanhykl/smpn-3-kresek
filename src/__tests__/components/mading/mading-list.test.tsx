import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MadingList } from '@/components/organisms/mading/MadingList';
import type { Mading } from '@config/types';

const items: Mading[] = [
  { id: '1', title: 'Pengumuman Libur', body: 'Sekolah libur', images: [], createdAt: '2026-01-01T00:00:00.000Z' },
  { id: '2', title: 'Juara Lomba', body: 'Tim basket menang', images: [], createdAt: '2026-03-01T00:00:00.000Z' },
];

describe('MadingList', () => {
  it('renders all posts initially, newest first', () => {
    render(<MadingList items={items} />);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings[0]).toContain('Juara');
  });

  it('filters by title or body via search', async () => {
    render(<MadingList items={items} />);
    await userEvent.type(screen.getByRole('searchbox'), 'basket');
    expect(screen.queryByText(/Pengumuman Libur/)).not.toBeInTheDocument();
    expect(screen.getByText(/Juara Lomba/)).toBeInTheDocument();
  });

  it('sorts oldest-first when selected', async () => {
    render(<MadingList items={items} />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'oldest');
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings[0]).toContain('Pengumuman');
  });
});
