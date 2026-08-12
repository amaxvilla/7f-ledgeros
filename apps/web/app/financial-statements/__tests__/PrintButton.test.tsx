import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PrintButton } from '../PrintButton';

describe('PrintButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the print button', () => {
    render(<PrintButton />);
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('calls window.print() when clicked', async () => {
    const printMock = vi.fn();
    window.print = printMock;
    const user = userEvent.setup();
    render(<PrintButton />);

    await user.click(screen.getByRole('button', { name: 'Print' }));

    expect(printMock).toHaveBeenCalledTimes(1);
  });
});
