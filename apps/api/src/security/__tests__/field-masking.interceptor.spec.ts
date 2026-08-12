import { of } from 'rxjs';
import { PERMISSIONS } from '@7f/config';
import { FieldMaskingInterceptor } from '../field-masking.interceptor';
import { SecurityContextService } from '../security-context.service';
import { MASK_FIELDS_KEY } from '../decorators/mask-fields.decorator';
import { MASKED_VALUE } from '../security.types';

function buildContext(user: unknown, metadata: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
    __metadata: metadata,
  } as any;
}

function buildReflector(metadata: unknown) {
  return { getAllAndOverride: jest.fn().mockReturnValue(metadata) } as any;
}

describe('FieldMaskingInterceptor', () => {
  let securityContext: SecurityContextService;

  beforeEach(() => {
    securityContext = new SecurityContextService({ entity: { findMany: jest.fn() } } as any);
  });

  it('passes the response through unchanged when no @MaskFields metadata is present', (done) => {
    const interceptor = new FieldMaskingInterceptor(buildReflector(undefined), securityContext);
    const context = buildContext({ id: 'u1', permissions: [] }, undefined);
    const handler = { handle: () => of({ baseSalary: 50000 }) };

    interceptor.intercept(context, handler as any).subscribe((result) => {
      expect(result).toEqual({ baseSalary: 50000 });
      done();
    });
  });

  it('masks a top-level field the user lacks permission to view', (done) => {
    const specs = [{ group: 'salary', fields: ['baseSalary'] }];
    const interceptor = new FieldMaskingInterceptor(buildReflector(specs), securityContext);
    const context = buildContext({ id: 'u1', permissions: [] }, specs);
    const handler = { handle: () => of({ id: 'emp-1', baseSalary: 50000, name: 'Jane' }) };

    interceptor.intercept(context, handler as any).subscribe((result: any) => {
      expect(result.baseSalary).toBe(MASKED_VALUE);
      expect(result.name).toBe('Jane');
      done();
    });
  });

  it('leaves the field unmasked when the user holds the group permission', (done) => {
    const specs = [{ group: 'salary', fields: ['baseSalary'] }];
    const interceptor = new FieldMaskingInterceptor(buildReflector(specs), securityContext);
    const context = buildContext({ id: 'u1', permissions: [PERMISSIONS.SECURITY_VIEW_SALARY] }, specs);
    const handler = { handle: () => of({ baseSalary: 50000 }) };

    interceptor.intercept(context, handler as any).subscribe((result: any) => {
      expect(result.baseSalary).toBe(50000);
      done();
    });
  });

  it('masks matching fields inside arrays and nested objects', (done) => {
    const specs = [{ group: 'bankDetails', fields: ['iban'] }];
    const interceptor = new FieldMaskingInterceptor(buildReflector(specs), securityContext);
    const context = buildContext({ id: 'u1', permissions: [] }, specs);
    const handler = {
      handle: () =>
        of([
          { id: '1', payroll: { iban: 'GB00BANK00000000', amount: 100 } },
          { id: '2', payroll: { iban: 'GB11BANK11111111', amount: 200 } },
        ]),
    };

    interceptor.intercept(context, handler as any).subscribe((result: any) => {
      expect(result[0].payroll.iban).toBe(MASKED_VALUE);
      expect(result[0].payroll.amount).toBe(100);
      expect(result[1].payroll.iban).toBe(MASKED_VALUE);
      done();
    });
  });

  it('masks everything declared when there is no authenticated user on the request', (done) => {
    const specs = [{ group: 'salary', fields: ['baseSalary'] }];
    const interceptor = new FieldMaskingInterceptor(buildReflector(specs), securityContext);
    const context = buildContext(undefined, specs);
    const handler = { handle: () => of({ baseSalary: 50000 }) };

    interceptor.intercept(context, handler as any).subscribe((result: any) => {
      expect(result.baseSalary).toBe(MASKED_VALUE);
      done();
    });
  });

  it('only masks the groups the user actually lacks, leaving other groups on the same route untouched', (done) => {
    const specs = [
      { group: 'salary', fields: ['baseSalary'] },
      { group: 'bankDetails', fields: ['iban'] },
    ];
    const interceptor = new FieldMaskingInterceptor(buildReflector(specs), securityContext);
    const context = buildContext({ id: 'u1', permissions: [PERMISSIONS.SECURITY_VIEW_SALARY] }, specs);
    const handler = { handle: () => of({ baseSalary: 50000, iban: 'GB00BANK00000000' }) };

    interceptor.intercept(context, handler as any).subscribe((result: any) => {
      expect(result.baseSalary).toBe(50000);
      expect(result.iban).toBe(MASKED_VALUE);
      done();
    });
  });
});

// Sanity check the metadata key stays what the decorator writes, since the
// interceptor and decorator must agree without importing each other's
// internals in the wrong direction.
describe('MASK_FIELDS_KEY', () => {
  it('is a stable string', () => {
    expect(MASK_FIELDS_KEY).toBe('maskFields');
  });
});
