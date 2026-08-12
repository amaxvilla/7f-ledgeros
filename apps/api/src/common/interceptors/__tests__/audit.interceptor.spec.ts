import { of } from 'rxjs';
import { AuditInterceptor } from '../audit.interceptor';

/**
 * PH-3.2 — End-to-End & Regression Testing (continuing PH-3.1's own
 * `apps/api/src/common/` coverage gap: this directory had zero test files
 * of any kind before that checkpoint). `AuditInterceptor` is the
 * fire-and-forget safety net that logs every mutating request — untested
 * until now. Follows the existing `FieldMaskingInterceptor` spec's own
 * `of()`/`done()` convention (`apps/api/src/security/__tests__/field-masking.interceptor.spec.ts`)
 * rather than inventing a new interceptor-testing style.
 */
function buildContext(request: unknown, className = 'InvoiceController') {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getClass: () => ({ name: className }),
  } as any;
}

describe('AuditInterceptor', () => {
  it('does not write an audit row for a non-mutating (GET) request', (done) => {
    const create = jest.fn().mockResolvedValue({});
    const interceptor = new AuditInterceptor({ auditLog: { create } } as any);
    const context = buildContext({ method: 'GET', url: '/api/v1/invoices', user: { id: 'u1' }, ip: '127.0.0.1' });
    const handler = { handle: () => of({ id: 'inv-1' }) };

    interceptor.intercept(context, handler as any).subscribe((result: any) => {
      expect(result).toEqual({ id: 'inv-1' });
      // Give the (would-be) fire-and-forget write a tick to happen if it were going to.
      setImmediate(() => {
        expect(create).not.toHaveBeenCalled();
        done();
      });
    });
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('writes an audit row for a mutating (%s) request', (method, done) => {
    const create = jest.fn().mockResolvedValue({});
    const interceptor = new AuditInterceptor({ auditLog: { create } } as any);
    const context = buildContext({ method, url: '/api/v1/invoices/inv-1', user: { id: 'u1' }, ip: '10.0.0.5' });
    const handler = { handle: () => of({ id: 'inv-1', total: 500 }) };

    interceptor.intercept(context, handler as any).subscribe(() => {
      setImmediate(() => {
        expect(create).toHaveBeenCalledTimes(1);
        const { data } = create.mock.calls[0][0];
        expect(data.userId).toBe('u1');
        expect(data.action).toBe(`${method} /api/v1/invoices/inv-1`);
        expect(data.entityType).toBe('Invoice');
        expect(data.entityId).toBe('inv-1');
        expect(data.ipAddress).toBe('10.0.0.5');
        expect(data.afterState).toEqual({ id: 'inv-1', total: 500 });
        done();
      });
    });
  });

  it('strips "Controller" from the class name to derive entityType', (done) => {
    const create = jest.fn().mockResolvedValue({});
    const interceptor = new AuditInterceptor({ auditLog: { create } } as any);
    const context = buildContext(
      { method: 'POST', url: '/api/v1/accounts-payable', user: { id: 'u1' }, ip: '127.0.0.1' },
      'AccountsPayableController',
    );
    const handler = { handle: () => of({ id: 'ap-1' }) };

    interceptor.intercept(context, handler as any).subscribe(() => {
      setImmediate(() => {
        expect(create.mock.calls[0][0].data.entityType).toBe('AccountsPayable');
        done();
      });
    });
  });

  it('falls back to "unknown" entityId and null userId when the response body has no id / no authenticated user', (done) => {
    const create = jest.fn().mockResolvedValue({});
    const interceptor = new AuditInterceptor({ auditLog: { create } } as any);
    const context = buildContext({ method: 'DELETE', url: '/api/v1/invoices/inv-1', user: undefined, ip: '127.0.0.1' });
    const handler = { handle: () => of({ success: true }) };

    interceptor.intercept(context, handler as any).subscribe(() => {
      setImmediate(() => {
        const { data } = create.mock.calls[0][0];
        expect(data.entityId).toBe('unknown');
        expect(data.userId).toBeNull();
        done();
      });
    });
  });

  it('never breaks the response stream when the audit write itself rejects', (done) => {
    const create = jest.fn().mockRejectedValue(new Error('db unreachable'));
    const interceptor = new AuditInterceptor({ auditLog: { create } } as any);
    const context = buildContext({ method: 'POST', url: '/api/v1/invoices', user: { id: 'u1' }, ip: '127.0.0.1' });
    const handler = { handle: () => of({ id: 'inv-1' }) };

    interceptor.intercept(context, handler as any).subscribe((result: any) => {
      // The response itself still reaches the caller even though the
      // fire-and-forget audit write failed — that's the whole point of the
      // .catch(() => {}) in the interceptor's own source.
      expect(result).toEqual({ id: 'inv-1' });
      done();
    });
  });
});
