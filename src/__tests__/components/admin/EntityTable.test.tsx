import { render, screen, fireEvent } from '@testing-library/react';
import { EntityTable } from '@/components/admin/EntityTable';

type Row = { id: string; name: string; cat: string };
const rows: Row[] = [
  { id: '1', name: 'Alpha', cat: 'x' },
  { id: '2', name: 'Beta', cat: 'y' },
  { id: '3', name: 'Gamma', cat: 'x' },
];

function renderTable(props: Partial<React.ComponentProps<typeof EntityTable<Row>>> = {}) {
  return render(
    <EntityTable<Row>
      rows={rows}
      getId={(r) => r.id}
      getSearchText={(r) => r.name}
      columns={[
        { header: 'Nama', cell: (r) => r.name },
        { header: 'Kategori', cell: (r) => r.cat },
      ]}
      onEdit={props.onEdit ?? (() => {})}
      onDelete={props.onDelete ?? (() => {})}
      onReorder={props.onReorder ?? (() => {})}
      {...props}
    />,
  );
}

describe('EntityTable', () => {
  it('renders all rows', () => {
    renderTable();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('filters rows by search text', () => {
    renderTable();
    const search = screen.getByPlaceholderText(/cari/i);
    fireEvent.change(search, { target: { value: 'Bet' } });
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('calls onEdit with the row when Edit clicked', () => {
    const onEdit = jest.fn();
    renderTable({ onEdit });
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0]!);
    expect(onEdit).toHaveBeenCalledWith(rows[0]);
  });

  it('calls onDelete with the row when Delete clicked', () => {
    const onDelete = jest.fn();
    renderTable({ onDelete });
    fireEvent.click(screen.getAllByRole('button', { name: /hapus/i })[0]!);
    expect(onDelete).toHaveBeenCalledWith(rows[0]);
  });

  it('shows empty state when no rows match', () => {
    renderTable();
    fireEvent.change(screen.getByPlaceholderText(/cari/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/tidak ada/i)).toBeInTheDocument();
  });
});
