import { render, screen } from '@testing-library/react';
import { BadgeLevel } from '@components/atoms/BadgeLevel';

describe('BadgeLevel', () => {
  it.each(['kabupaten', 'provinsi', 'nasional', 'internasional'] as const)(
    'renders the correct label for %s',
    (level) => {
      render(<BadgeLevel level={level} />);
      expect(screen.getByText(new RegExp(level, 'i'))).toBeInTheDocument();
    },
  );
});
