import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, LinkButton } from '@components/atoms/Button';

describe('Button', () => {
  it('renders children and reacts to clicks', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the variant class for primary', () => {
    render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-primary');
  });

  it('applies the variant class for outline', () => {
    render(<Button variant="outline">Outline</Button>);
    expect(screen.getByRole('button').className).toContain('border-white/50');
  });
});

describe('LinkButton', () => {
  it('renders an anchor with the given href and label', () => {
    render(<LinkButton href="/foo">Go</LinkButton>);
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('href', '/foo');
  });
});
