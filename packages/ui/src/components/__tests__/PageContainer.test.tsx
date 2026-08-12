import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageContainer } from '../PageContainer';
import { tokens } from '../../tokens';

describe('PageContainer', () => {
  it('renders its children inside the shared wrapper class', () => {
    render(
      <PageContainer>
        <p>Dashboard content</p>
      </PageContainer>,
    );

    expect(screen.getByText('Dashboard content')).toBeInTheDocument();
    const main = screen.getByText('Dashboard content').closest('main');
    expect(main).toHaveClass('x7fpage-main');
  });

  it('emits a 640px-max-width media query that reduces padding, matching Nav\'s breakpoint', () => {
    const { container } = render(
      <PageContainer>
        <span>content</span>
      </PageContainer>,
    );

    const styleTag = container.querySelector('style');
    expect(styleTag).not.toBeNull();
    const css = styleTag?.textContent ?? '';

    expect(css).toContain('@media (max-width: 640px)');
    // Full padding above the breakpoint, reduced padding at/below it —
    // asserted against the actual tokens rather than hardcoded pixel
    // values, so this doesn't silently drift if the scale changes.
    expect(css).toContain(`padding: ${tokens.space(8)};`);
    expect(css).toContain(`padding: ${tokens.space(4)} ${tokens.space(3)};`);
  });
});
