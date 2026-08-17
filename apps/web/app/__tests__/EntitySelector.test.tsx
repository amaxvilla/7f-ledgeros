import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';

const router = {
  push: vi.fn(),
  replace: vi.fn(),
};

const searchParams = new URLSearchParams('page=2');

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/entities',
  useSearchParams: () => searchParams,
}));

import { EntitySelector } from '../EntitySelector';

const entities = [
  {
    id: 'ent-1',
    code: 'ENT001',
    name: 'Entity One',
    legalName: 'Entity One Limited',
    baseCurrency: 'NGN',
    isActive: true,
    isConsolidationParent: false,
  },
  {
    id: 'ent-2',
    code: 'ENT002',
    name: 'Entity Two',
    legalName: 'Entity Two Limited',
    baseCurrency: 'USD',
    isActive: true,
    isConsolidationParent: false,
  },
];

describe('EntitySelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => entities,
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the entity selector and loads entities', async () => {
    render(<EntitySelector />);

    expect(screen.getByLabelText('Entity')).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'ENT001 — Entity One' }),
      ).toBeInTheDocument();

      expect(
        screen.getByRole('option', { name: 'ENT002 — Entity Two' }),
      ).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith('/api/entities', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
  });

  it('uses initialValue when it matches a loaded entity', async () => {
    render(<EntitySelector initialValue="ent-2" />);

    const selector = await screen.findByLabelText('Entity');

    await waitFor(() => {
      expect(selector).toHaveValue('ent-2');
    });

    expect(router.replace).not.toHaveBeenCalled();
  });

  it('falls back to the remembered entity from localStorage', async () => {
    localStorage.setItem('ledgeros-selected-entity-id', 'ent-2');

    render(<EntitySelector />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        '/entities?page=2&entityId=ent-2',
      );
    });

    expect(
      localStorage.getItem('ledgeros-selected-entity-id'),
    ).toBe('ent-2');
  });

  it('falls back to the first entity when there is no remembered selection', async () => {
    render(<EntitySelector />);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(
        '/entities?page=2&entityId=ent-1',
      );
    });

    expect(
      localStorage.getItem('ledgeros-selected-entity-id'),
    ).toBe('ent-1');
  });

  it('pushes the selected entity into the URL when the selection changes', async () => {
    render(<EntitySelector initialValue="ent-1" />);

    const selector = await screen.findByLabelText('Entity');

    await waitFor(() => {
      expect(selector).toHaveValue('ent-1');
    });

    fireEvent.change(selector, {
      target: { value: 'ent-2' },
    });

    expect(
      localStorage.getItem('ledgeros-selected-entity-id'),
    ).toBe('ent-2');

    expect(router.push).toHaveBeenCalledWith(
      '/entities?page=2&entityId=ent-2',
    );
  });

  it('displays an API error when entities cannot be loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Unable to load entities',
      }),
    );

    render(<EntitySelector />);

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('Unable to load entities');
  });

  it('shows an empty state when no entities are returned', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      }),
    );

    render(<EntitySelector />);

    expect(
      await screen.findByRole('option', {
        name: 'No active entities available',
      }),
    ).toBeInTheDocument();

    expect(router.replace).not.toHaveBeenCalled();
  });
});
