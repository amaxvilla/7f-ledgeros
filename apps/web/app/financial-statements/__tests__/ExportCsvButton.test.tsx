import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ExportCsvButton } from '../ExportCsvButton';

describe('ExportCsvButton', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let clickMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLMock = vi.fn(() => 'blob:mock-url');
    revokeObjectURLMock = vi.fn();
    URL.createObjectURL = createObjectURLMock;
    URL.revokeObjectURL = revokeObjectURLMock;
    clickMock = vi.fn();
    HTMLAnchorElement.prototype.click = clickMock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the export button', () => {
    render(<ExportCsvButton filename="test" rows={[{ a: 1 }]} />);
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
  });

  it('creates a blob URL and triggers a download when clicked', async () => {
    const user = userEvent.setup();
    render(<ExportCsvButton filename="my-report" rows={[{ code: 'A1', amount: 100 }]} />);

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/csv;charset=utf-8;');
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });

  it('quotes fields containing commas or quotes', async () => {
    const user = userEvent.setup();
    let capturedBlob: Blob | null = null;
    createObjectURLMock.mockImplementation((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock-url';
    });
    render(<ExportCsvButton filename="test" rows={[{ name: 'Smith, "Big" Co' }]} />);

    await user.click(screen.getByRole('button', { name: 'Export CSV' }));

    // jsdom's own Blob implementation (used here, not a real browser's)
    // has no `.text()`/`.arrayBuffer()` of its own — confirmed directly by
    // construction (root-caused in FE-10.8, fixed here in FE-10.9) rather
    // than assumed working. `FileReader.readAsText`, which jsdom does
    // implement, reads the same captured `Blob` instead.
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(capturedBlob!);
    });
    expect(text).toContain('"Smith, ""Big"" Co"');
  });
});
