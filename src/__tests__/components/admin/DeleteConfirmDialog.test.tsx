import { render, screen, fireEvent } from '@testing-library/react';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';

describe('DeleteConfirmDialog', () => {
  it('disables confirm until the exact name is typed', () => {
    const onConfirm = jest.fn();
    render(
      <DeleteConfirmDialog
        open
        itemName="Bu Siti"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    const confirmBtn = screen.getByRole('button', { name: /hapus permanen/i });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByLabelText(/ketik nama/i);
    fireEvent.change(input, { target: { value: 'Bu Sit' } });
    expect(confirmBtn).toBeDisabled();

    fireEvent.change(input, { target: { value: 'Bu Siti' } });
    expect(confirmBtn).toBeEnabled();

    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not render when open is false', () => {
    const { container } = render(
      <DeleteConfirmDialog open={false} itemName="x" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onCancel when cancel clicked', () => {
    const onCancel = jest.fn();
    render(<DeleteConfirmDialog open itemName="X" onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /batal/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
