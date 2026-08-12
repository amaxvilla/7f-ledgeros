import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { KeyValueEditor, pairsToObject, objectToPairs } from '../KeyValueEditor';

describe('pairsToObject', () => {
  it('converts string, numeric, and boolean-looking values', () => {
    expect(
      pairsToObject([
        { key: 'region', value: 'us-east-1' },
        { key: 'retries', value: '5' },
        { key: 'enabled', value: 'true' },
      ]),
    ).toEqual({ region: 'us-east-1', retries: 5, enabled: true });
  });

  it('skips pairs with an empty key', () => {
    expect(pairsToObject([{ key: '', value: 'ignored' }, { key: 'kept', value: 'x' }])).toEqual({ kept: 'x' });
  });
});

describe('objectToPairs', () => {
  it('converts a plain object into key/value pairs', () => {
    expect(objectToPairs({ region: 'us-east-1', retries: 5 })).toEqual([
      { key: 'region', value: 'us-east-1' },
      { key: 'retries', value: '5' },
    ]);
  });

  it('returns an empty array for null or undefined', () => {
    expect(objectToPairs(null)).toEqual([]);
    expect(objectToPairs(undefined)).toEqual([]);
  });
});

describe('KeyValueEditor', () => {
  it('renders one row per pair plus an add-field button', () => {
    render(<KeyValueEditor pairs={[{ key: 'region', value: 'us-east-1' }]} onChange={vi.fn()} />);

    expect(screen.getByDisplayValue('region')).toBeInTheDocument();
    expect(screen.getByDisplayValue('us-east-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add field' })).toBeInTheDocument();
  });

  it('calls onChange with an added empty pair when "+ Add field" is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<KeyValueEditor pairs={[{ key: 'region', value: 'us-east-1' }]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '+ Add field' }));

    expect(onChange).toHaveBeenCalledWith([
      { key: 'region', value: 'us-east-1' },
      { key: '', value: '' },
    ]);
  });

  it('calls onChange with the pair removed when "Remove" is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <KeyValueEditor
        pairs={[
          { key: 'region', value: 'us-east-1' },
          { key: 'bucket', value: 'my-bucket' },
        ]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(onChange).toHaveBeenCalledWith([{ key: 'bucket', value: 'my-bucket' }]);
  });
});
