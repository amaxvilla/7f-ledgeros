import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SessionSelector } from '../SessionSelector';

describe('SessionSelector', () => {
  it('renders a sessionId input and submit button', () => {
    render(<SessionSelector />);

    expect(screen.getByLabelText('Session ID')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Work session' })).toBeInTheDocument();
  });

  it('includes a hidden entityId passthrough field when entityId is provided', () => {
    const { container } = render(<SessionSelector entityId="ent-1" initialValue="sess-1" />);

    const hidden = container.querySelector('input[type="hidden"][name="entityId"]') as HTMLInputElement;
    expect(hidden).toBeInTheDocument();
    expect(hidden.value).toBe('ent-1');
    expect(screen.getByLabelText('Session ID')).toHaveValue('sess-1');
  });

  it('omits the hidden entityId field when entityId is not provided', () => {
    const { container } = render(<SessionSelector />);

    expect(container.querySelector('input[type="hidden"][name="entityId"]')).not.toBeInTheDocument();
  });
});
