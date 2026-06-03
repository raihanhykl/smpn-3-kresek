import { render, screen } from '@testing-library/react';
import { MultiImagePicker } from '@/components/admin/form/MultiImagePicker';
import type { MadingImage } from '@config/types';

const noopPicker = jest.fn(async () => null);

describe('MultiImagePicker', () => {
  it('renders the empty state when value is []', () => {
    render(<MultiImagePicker value={[]} onChange={() => {}} openImagePicker={noopPicker} />);
    expect(screen.getByText(/belum ada gambar/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('renders N rows for N images', () => {
    const value: MadingImage[] = [
      { src: 'smpn3kresek/a', alt: 'Gambar A' },
      { src: 'smpn3kresek/b', alt: 'Gambar B' },
      { src: 'smpn3kresek/c', alt: 'Gambar C' },
    ];
    render(<MultiImagePicker value={value} onChange={() => {}} openImagePicker={noopPicker} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByDisplayValue('Gambar A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Gambar C')).toBeInTheDocument();
  });
});
