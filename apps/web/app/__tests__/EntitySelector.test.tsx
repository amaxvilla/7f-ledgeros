import * as React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntitySelector } from '../EntitySelector';

describe('EntitySelector', () => {
  it('associates the "Entity ID" label with its input', () => {
    render(<EntitySelector />);
    expect(screen.getByLabelText('Entity ID')).toBeInTheDocument();
  });

  it('renders a GET form so submitting navigates with a new ?entityId= query param', () => {
    render(<EntitySelector />);
    const form = screen.getByRole('button', { name: 'View' }).closest('form') as HTMLFormElement;
    expect(form).toHaveAttribute('method', 'GET');
  });

  it('pre-fills the input from initialValue', () => {
    render(<EntitySelector initialValue="ent-1" />);
    expect(screen.getByLabelText('Entity ID')).toHaveValue('ent-1');
  });
});
