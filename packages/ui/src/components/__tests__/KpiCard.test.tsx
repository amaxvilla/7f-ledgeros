import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiCard } from '../KpiCard';
import { tokens } from '../../tokens';

describe('KpiCard — required content', () => {
  it('renders the label and value', () => {
    render(<KpiCard label="Cash on Hand" value="$1,204,500" />);

    expect(screen.getByText('Cash on Hand')).toBeInTheDocument();
    expect(screen.getByText('$1,204,500')).toBeInTheDocument();
  });

  it('omits the caption row entirely when neither caption nor asOf is provided', () => {
    const { container } = render(<KpiCard label="Cash on Hand" value="$1,204,500" />);

    // Only two <span> text nodes (label, value) should exist — no third
    // span for an empty caption row that would otherwise render as a
    // blank line under the figure.
    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(2);
  });
});

describe('KpiCard — caption and asOf composition', () => {
  it('renders caption alone without a separator', () => {
    render(<KpiCard label="Cash on Hand" value="$1,204,500" caption="Across 4 entities" />);

    expect(screen.getByText((_, node) => node?.textContent === 'Across 4 entities')).toBeInTheDocument();
  });

  it('renders asOf alone, prefixed with "as of"', () => {
    render(<KpiCard label="Cash on Hand" value="$1,204,500" asOf="31 Jul 2026" />);

    expect(screen.getByText((_, node) => node?.textContent === 'as of 31 Jul 2026')).toBeInTheDocument();
  });

  it('joins caption and asOf with a middle-dot separator when both are provided', () => {
    render(
      <KpiCard label="Cash on Hand" value="$1,204,500" caption="Across 4 entities" asOf="31 Jul 2026" />,
    );

    expect(
      screen.getByText((_, node) => node?.textContent === 'Across 4 entities · as of 31 Jul 2026'),
    ).toBeInTheDocument();
  });
});

describe('KpiCard — tone color mapping', () => {
  it('defaults to the neutral tone color when no tone is given', () => {
    render(<KpiCard label="Cash on Hand" value="$1,204,500" />);

    expect(screen.getByText('$1,204,500')).toHaveStyle({ color: tokens.color.textPrimary });
  });

  it.each([
    ['positive', tokens.color.positive],
    ['negative', tokens.color.negative],
    ['warning', tokens.color.warning],
  ] as const)('applies the %s tone color to the value figure', (tone, expectedColor) => {
    render(<KpiCard label="Variance" value="-$4,200" tone={tone} />);

    expect(screen.getByText('-$4,200')).toHaveStyle({ color: expectedColor });
  });
});
