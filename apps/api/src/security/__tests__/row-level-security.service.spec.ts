import { RowLevelSecurityService } from '../row-level-security.service';
import { SecurityScope } from '../security.types';

function buildScope(overrides: Partial<SecurityScope> = {}): SecurityScope {
  return {
    userId: 'user-1',
    isSystemAdmin: false,
    entity: { unrestricted: false, viewableIds: [], postableIds: [] },
    department: { unrestricted: true, viewableIds: [], postableIds: [] },
    costCenter: { unrestricted: true, viewableIds: [], postableIds: [] },
    project: { unrestricted: true, viewableIds: [], postableIds: [] },
    businessUnit: { unrestricted: true, viewableIds: [], postableIds: [] },
    ...overrides,
  };
}

describe('RowLevelSecurityService', () => {
  let service: RowLevelSecurityService;

  beforeEach(() => {
    service = new RowLevelSecurityService();
  });

  describe('buildWhere', () => {
    it('returns an empty object when every requested dimension is unrestricted', () => {
      const scope = buildScope({ entity: { unrestricted: true, viewableIds: [], postableIds: [] } });
      const where = service.buildWhere(scope, { dimensions: ['entity', 'department'] });
      expect(where).toEqual({});
    });

    it('filters by viewableIds for a single restricted dimension', () => {
      const scope = buildScope({
        entity: { unrestricted: false, viewableIds: ['ent-1', 'ent-2'], postableIds: ['ent-1'] },
      });
      const where = service.buildWhere(scope, { dimensions: ['entity'] });
      expect(where).toEqual({ entityId: { in: ['ent-1', 'ent-2'] } });
    });

    it('fails closed (matches nothing) for a restricted dimension with zero grants', () => {
      const scope = buildScope({
        entity: { unrestricted: false, viewableIds: [], postableIds: [] },
      });
      const where = service.buildWhere(scope, { dimensions: ['entity'] });
      expect(where).toEqual({ entityId: { in: [] } });
    });

    it('combines multiple restricted dimensions with AND', () => {
      const scope = buildScope({
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
        department: { unrestricted: false, viewableIds: ['dept-1'], postableIds: [] },
      });
      const where = service.buildWhere(scope, { dimensions: ['entity', 'department'] });
      expect(where).toEqual({
        AND: [{ entityId: { in: ['ent-1'] } }, { departmentId: { in: ['dept-1'] } }],
      });
    });

    it('businessUnit dimension filters on the same entityId column as the entity dimension', () => {
      const scope = buildScope({
        entity: { unrestricted: true, viewableIds: [], postableIds: [] },
        businessUnit: { unrestricted: false, viewableIds: ['ent-1', 'ent-2'], postableIds: ['ent-1'] },
      });
      const where = service.buildWhere(scope, { dimensions: ['entity', 'businessUnit'] });
      // entity is unrestricted (no clause); businessUnit resolves to entityId too
      expect(where).toEqual({ entityId: { in: ['ent-1', 'ent-2'] } });
    });

    it('uses postableIds instead of viewableIds when mode is "post"', () => {
      const scope = buildScope({
        entity: { unrestricted: false, viewableIds: ['ent-1', 'ent-2'], postableIds: ['ent-1'] },
      });
      const where = service.buildWhere(scope, { dimensions: ['entity'], mode: 'post' });
      expect(where).toEqual({ entityId: { in: ['ent-1'] } });
    });
  });

  describe('canAccess', () => {
    it('returns true when the dimension is unrestricted', () => {
      const scope = buildScope({ entity: { unrestricted: true, viewableIds: [], postableIds: [] } });
      expect(service.canAccess(scope, { entityId: 'ent-99' }, { dimensions: ['entity'] })).toBe(true);
    });

    it('returns true when the record id is in the viewable set', () => {
      const scope = buildScope({
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      });
      expect(service.canAccess(scope, { entityId: 'ent-1' }, { dimensions: ['entity'] })).toBe(true);
    });

    it('returns false when the record id is not in the viewable set', () => {
      const scope = buildScope({
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      });
      expect(service.canAccess(scope, { entityId: 'ent-2' }, { dimensions: ['entity'] })).toBe(false);
    });

    it('requires all declared dimensions to pass', () => {
      const scope = buildScope({
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
        department: { unrestricted: false, viewableIds: ['dept-1'], postableIds: [] },
      });
      expect(
        service.canAccess(
          scope,
          { entityId: 'ent-1', departmentId: 'dept-2' },
          { dimensions: ['entity', 'department'] },
        ),
      ).toBe(false);
    });

    it('skips a dimension the record has no value for (model does not populate that FK)', () => {
      const scope = buildScope({
        department: { unrestricted: false, viewableIds: ['dept-1'], postableIds: [] },
      });
      expect(
        service.canAccess(scope, { departmentId: null }, { dimensions: ['department'] }),
      ).toBe(true);
    });

    it('checks postableIds instead of viewableIds when mode is "post"', () => {
      const scope = buildScope({
        entity: { unrestricted: false, viewableIds: ['ent-1'], postableIds: [] },
      });
      expect(
        service.canAccess(scope, { entityId: 'ent-1' }, { dimensions: ['entity'], mode: 'post' }),
      ).toBe(false);
    });
  });
});
