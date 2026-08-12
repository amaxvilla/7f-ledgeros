import { PartnerApiVersionController } from '../partner-api-version.controller';

describe('PartnerApiVersionController', () => {
  it('returns the current and supported partner-api versions, with no deprecations yet', () => {
    const controller = new PartnerApiVersionController();
    expect(controller.version()).toEqual({ current: 'v1', supported: ['v1'], deprecated: [] });
  });
});
