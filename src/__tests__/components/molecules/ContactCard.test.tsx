import { render, screen } from '@testing-library/react';
import { ContactCard } from '@components/molecules/ContactCard';
import type { ContactCard as ContactCardData } from '@config/types';

describe('ContactCard', () => {
  it('renders the address variant without an action link', () => {
    const data: ContactCardData = {
      kind: 'address',
      icon: '📍',
      label: 'Alamat',
      value: 'Jl. Test 1',
      sub: 'Tangerang',
    };
    render(<ContactCard data={data} />);
    expect(screen.getByText('Alamat')).toBeInTheDocument();
    expect(screen.getByText('Jl. Test 1')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders a clickable phone variant', () => {
    const data: ContactCardData = {
      kind: 'phone',
      icon: '📞',
      label: 'Telepon',
      value: '(021) 123',
      sub: 'WIB',
      href: 'tel:+62211',
      linkText: 'Hubungi →',
    };
    render(<ContactCard data={data} />);
    const link = screen.getByRole('link', { name: 'Hubungi →' });
    expect(link).toHaveAttribute('href', 'tel:+62211');
  });

  it('renders the hours variant with warn tone styling', () => {
    const data: ContactCardData = {
      kind: 'hours',
      icon: '🕐',
      label: 'Jam',
      value: 'Senin–Jumat',
      sub: 'Tutup hari libur',
      subTone: 'warn',
    };
    render(<ContactCard data={data} />);
    expect(screen.getByText('Tutup hari libur').className).toContain('text-[#EF4444]');
  });
});
