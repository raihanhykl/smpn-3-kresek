import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterTabs } from '@components/molecules/FilterTabs';

describe('FilterTabs', () => {
  it('renders all tabs with the active one marked selected', () => {
    render(
      <FilterTabs
        tabs={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        active="a"
        onChange={() => undefined}
      />,
    );
    const tabA = screen.getByRole('tab', { name: 'A' });
    const tabB = screen.getByRole('tab', { name: 'B' });
    expect(tabA).toHaveAttribute('aria-selected', 'true');
    expect(tabB).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onChange with the clicked value', async () => {
    const onChange = jest.fn();
    render(
      <FilterTabs
        tabs={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        active="a"
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
