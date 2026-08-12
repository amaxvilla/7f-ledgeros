import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, PageHeader } from '../Badge';
import { tokens } from '../../tokens';

describe('Badge — tone styling', () => {
  it('renders its children', () => {
    render(<Badge>Reconciled</Badge>);
    expect(screen.getByText('Reconciled')).toBeInTheDocument();
  });

  it('defaults to the neutral tone when none is given', () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText('Draft')).toHaveStyle({ color: tokens.color.textMuted });
  });

  it.each([
    ['positive', tokens.color.positive],
    ['negative', tokens.color.negative],
    ['warning', tokens.color.warning],
  ] as const)('applies the %s tone foreground color', (tone, expectedColor) => {
    render(<Badge tone={tone}>Status</Badge>);
    expect(screen.getByText('Status')).toHaveStyle({ color: expectedColor });
  });
});

describe('PageHeader — title and subtitle', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Payments" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Payments' })).toBeInTheDocument();
  });

  it('omits the subtitle paragraph entirely when none is provided', () => {
    const { container } = render(<PageHeader title="Payments" />);
    expect(container.querySelector('p')).toBeNull();
  });

  it('renders the subtitle when provided', () => {
    render(<PageHeader title="Payments" subtitle="All outbound transfers across entities" />);
    expect(screen.getByText('All outbound transfers across entities')).toBeInTheDocument();
  });

  it('renders no breadcrumb nav at all when none is provided', () => {
    render(<PageHeader title="Payments" />);
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('renders each breadcrumb link with its href, except the last', () => {
    render(
      <PageHeader
        title="Work Package WP-2024-003"
        breadcrumbs={[
          { label: 'Work Packages', href: '/work-packages' },
          { label: 'WP-2024-003' },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Work Packages' })).toHaveAttribute('href', '/work-packages');
    expect(screen.queryByRole('link', { name: 'WP-2024-003' })).not.toBeInTheDocument();
    expect(screen.getByText('WP-2024-003')).toHaveAttribute('aria-current', 'page');
  });

  it('never links the last crumb even if it has an href', () => {
    render(
      <PageHeader
        title="Dashboard"
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Dashboard', href: '/' }]}
      />,
    );

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent('Home');
  });

  it('renders a non-last crumb with no href as plain text, not a link', () => {
    render(
      <PageHeader
        title="WP-2024-003"
        breadcrumbs={[{ label: 'PMO' }, { label: 'Work Packages', href: '/work-packages' }, { label: 'WP-2024-003' }]}
      />,
    );

    expect(screen.queryByRole('link', { name: 'PMO' })).not.toBeInTheDocument();
    expect(screen.getByText('PMO')).toBeInTheDocument();
  });
});
