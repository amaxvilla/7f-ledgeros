import { HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exceptions.filter';

/**
 * PH-3.3 — End-to-End & Regression Testing (closing PH-3.2's own named
 * remaining gap). `AllExceptionsFilter` is the global `@Catch()` handler
 * — the last line of defense turning every thrown exception into a JSON
 * response — but had zero test coverage, confirmed directly by listing
 * `apps/api/src/common/filters/` before writing anything (it is the only
 * file in that directory, and the only one of the four files PH-3.1
 * originally named across guards/interceptors/filters still untested
 * after PH-3.2).
 *
 * Every assertion below was hand-traced against the filter's actual
 * current source (not its class name or doc comment): the `isHttp`
 * branch on `exception instanceof HttpException`, the exact response
 * body shape (`statusCode`, `path`, `timestamp`, then either the
 * exception's own response object spread in, or `{ message: body }` when
 * that response is a plain string, or the generic `{ message: 'Internal
 * server error' }` fallback for a non-HTTP exception), and that
 * `logger.error` is invoked only in the non-HTTP branch.
 */
function buildResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function buildHost(request: any, response: any) {
  return {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as any;
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jest.restoreAllMocks();
  });

  it('uses the HttpException\'s own status code and response body when given an object response', () => {
    const request = { method: 'GET', url: '/api/agents/123' };
    const response = buildResponse();
    const exception = new HttpException({ message: 'Agent not found', error: 'Not Found' }, HttpStatus.NOT_FOUND);

    filter.catch(exception, buildHost(request, response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        path: '/api/agents/123',
        message: 'Agent not found',
        error: 'Not Found',
      }),
    );
  });

  it('wraps a plain-string HttpException response body into a `message` field', () => {
    const request = { method: 'POST', url: '/api/commission-plans' };
    const response = buildResponse();
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, buildHost(request, response));

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.FORBIDDEN, message: 'Forbidden' }),
    );
  });

  it('falls back to a generic 500 and message for a non-HttpException', () => {
    const request = { method: 'GET', url: '/api/reports/summary' };
    const response = buildResponse();
    jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);

    filter.catch(new Error('db connection lost'), buildHost(request, response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' }),
    );
  });

  it('logs unhandled (non-HTTP) exceptions with the request method/url and the error stack', () => {
    const request = { method: 'DELETE', url: '/api/agents/999' };
    const response = buildResponse();
    const loggerSpy = jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);
    const error = new Error('boom');

    filter.catch(error, buildHost(request, response));

    expect(loggerSpy).toHaveBeenCalledWith('Unhandled exception on DELETE /api/agents/999', error.stack);
  });

  it('logs a stringified exception when a non-Error value is thrown', () => {
    const request = { method: 'GET', url: '/api/x' };
    const response = buildResponse();
    const loggerSpy = jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);

    filter.catch('a raw string throw', buildHost(request, response));

    expect(loggerSpy).toHaveBeenCalledWith('Unhandled exception on GET /api/x', 'a raw string throw');
  });

  it('never logs an error for a handled HttpException', () => {
    const request = { method: 'GET', url: '/api/x' };
    const response = buildResponse();
    const loggerSpy = jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined);

    filter.catch(new HttpException('Not found', HttpStatus.NOT_FOUND), buildHost(request, response));

    expect(loggerSpy).not.toHaveBeenCalled();
  });

  it('includes the request path and an ISO timestamp on every response', () => {
    const request = { method: 'GET', url: '/api/units/55' };
    const response = buildResponse();

    filter.catch(new HttpException('x', HttpStatus.BAD_REQUEST), buildHost(request, response));

    const body = response.json.mock.calls[0][0];
    expect(body.path).toBe('/api/units/55');
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
  });
});
