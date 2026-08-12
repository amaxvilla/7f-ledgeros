import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const embedMock = vi.fn();
const resetMock = vi.fn();
const ServiceMock = vi.fn().mockImplementation(() => ({ embed: embedMock, reset: resetMock }));

vi.mock('powerbi-client', () => ({
  service: { Service: ServiceMock },
  factories: { hpmFactory: 'hpm', wpmpFactory: 'wpmp', routerFactory: 'router' },
  models: { TokenType: { Embed: 0, Aad: 1 } },
}));

import { PowerBiEmbed } from '../PowerBiEmbed';

beforeEach(() => {
  embedMock.mockReset();
  resetMock.mockReset();
  ServiceMock.mockClear();
});

describe('PowerBiEmbed', () => {
  it('embeds the report with the given embedUrl, accessToken, and reportId as the SDK id', async () => {
    render(<PowerBiEmbed embedUrl="https://app.powerbi.com/reportEmbed?reportId=r1" accessToken="tok-123" reportId="r1" />);

    await waitFor(() => expect(embedMock).toHaveBeenCalled());

    const [, config] = embedMock.mock.calls[0];
    expect(config).toMatchObject({
      type: 'report',
      id: 'r1',
      embedUrl: 'https://app.powerbi.com/reportEmbed?reportId=r1',
      accessToken: 'tok-123',
      tokenType: 0,
    });
  });

  it('resets the embed on unmount', async () => {
    const { unmount } = render(<PowerBiEmbed embedUrl="https://app.powerbi.com/reportEmbed" accessToken="tok-123" reportId="r1" />);

    await waitFor(() => expect(embedMock).toHaveBeenCalled());

    unmount();
    expect(resetMock).toHaveBeenCalled();
  });

  it('re-embeds when accessToken changes (e.g. after a token refresh)', async () => {
    const { rerender } = render(<PowerBiEmbed embedUrl="https://app.powerbi.com/reportEmbed" accessToken="tok-1" reportId="r1" />);
    await waitFor(() => expect(embedMock).toHaveBeenCalledTimes(1));

    rerender(<PowerBiEmbed embedUrl="https://app.powerbi.com/reportEmbed" accessToken="tok-2" reportId="r1" />);
    await waitFor(() => expect(embedMock).toHaveBeenCalledTimes(2));

    expect(resetMock).toHaveBeenCalled();
    const [, secondConfig] = embedMock.mock.calls[1];
    expect(secondConfig.accessToken).toBe('tok-2');
  });

  it('shows an error message if embedding throws', async () => {
    ServiceMock.mockImplementationOnce(() => ({
      embed: () => {
        throw new Error('Invalid embed configuration');
      },
      reset: resetMock,
    }));

    const { findByText } = render(<PowerBiEmbed embedUrl="https://app.powerbi.com/reportEmbed" accessToken="tok-123" reportId="r1" />);

    expect(await findByText('Invalid embed configuration')).toBeInTheDocument();
  });
});
