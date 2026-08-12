import * as React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../ThemeToggle';

const STORAGE_KEY = 'ledgeros-theme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders a button with a theme label after mount', async () => {
    render(<ThemeToggle />);
    expect(await screen.findByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });

  it('defaults to dark (no data-theme attribute) when nothing is stored', async () => {
    render(<ThemeToggle />);
    await screen.findByRole('button', { name: 'Switch to light mode' });
    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
  });

  it('reads an existing "light" preference from localStorage on mount', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'light');
    render(<ThemeToggle />);
    expect(await screen.findByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggling from dark sets data-theme="light" and persists it', async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: 'Switch to light mode' });
    await user.click(button);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
  });

  it('toggling back from light removes the data-theme attribute and updates storage', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'light');
    const user = userEvent.setup();
    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: 'Switch to dark mode' });
    await user.click(button);

    expect(document.documentElement.getAttribute('data-theme')).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument();
  });
});
