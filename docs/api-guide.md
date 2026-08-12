# API Guide

Stage FC-5 (Documentation). This app already has a real, working
Swagger/OpenAPI surface — confirmed directly this checkpoint, not
assumed — so this guide doesn't duplicate it. It covers how to reach and
use that surface, plus the cross-cutting conventions (auth, entity
scoping, permissions, error shape) that apply across every route but
aren't things Swagger documents on its own.

## Swagger

- **URL**: `/api/docs`, confirmed directly in `apps/api/src/main.ts`.
- **On by default outside production.** In production it's off unless
  `SWAGGER_ENABLED=true` is set explicitly — it exposes the full route/DTO/
  auth surface to anyone who can reach it, so this is a deliberate
  production-safety default, not an oversight. See
  [`environment-configuration.md`](./environment-configuration.md).
- Documents both auth schemes this API supports (below) via
  `DocumentBuilder().addBearerAuth().addApiKey(...)`.

**Coverage, confirmed directly by grepping every controller/DTO rather
than assumed complete**: 71 of 82 controllers use `@ApiTags` (route
grouping shows up correctly in the UI for those), and 75 DTO files use
`@ApiProperty` (request/response shapes are documented for most of the
app). **Zero controllers use `@ApiOperation`** — every route's own
summary/description in the Swagger UI is Nest's auto-inferred one (from
the method name and DTO shape), not a hand-written one. In practice this
means: route grouping and request/response shapes in Swagger are
generally trustworthy; per-route prose descriptions are not — read the
controller source directly for the "why," not just the Swagger UI, until
`@ApiOperation` coverage is added (a real, separate, invasive
backend-touching checkpoint — decorating 82 controllers — deliberately
not attempted here, since this stage's own discipline is additive
documentation, not a backend change unless a verified frontend
dependency requires it).

## Base URL and routing

Every route is served under the `/api/v1` prefix (`app.setGlobalPrefix`),
confirmed directly — Swagger's own "Try it out" already accounts for
this, but any request built by hand needs the prefix too.

## Authentication

Two independent schemes, confirmed directly against `main.ts` and their
own guards — not interchangeable, and scoped to different surfaces:

1. **Bearer JWT** — the scheme every internal, employee-facing route
   uses. `POST /api/v1/auth/login` (email/password) returns an access
   token; `POST /api/v1/auth/refresh` exchanges a refresh token for a
   new one. Send the access token as `Authorization: Bearer <token>` on
   every subsequent request. `JWT_ACCESS_SECRET` must be set in
   production or the API refuses to start — see
   `environment-configuration.md`.
2. **API key (`X-API-Key` header)** — confirmed directly this is
   deliberately scoped to a separate, smaller partner-facing surface
   (`PartnerApiController`, guarded by `ApiKeyGuard`/`RateLimitGuard`/
   `ApiScopeGuard`), not an alternate way to call the internal routes
   bearer auth covers. Its own doc comment (read directly) explains why:
   an internal controller's response shape assumes an authenticated
   employee with RLS-scoped visibility into full record detail — a
   partner integration needs a deliberately different, narrower surface,
   so this is a separate controller rather than API-key auth bolted onto
   the existing internal ones.

## Permissions

Every protected route is gated by `@RequirePermissions('some.permission')`
(confirmed directly, `common/decorators/require-permissions.decorator.ts`)
— a `403` means the authenticated user's roles don't include that
permission code, not that the request itself was malformed. Permission
codes follow a `module.action` shape throughout this app (e.g.
`ap.manage`, `hse.manage`, `workflow.act`) — grep the relevant
controller directly for the exact code a given route requires; Swagger's
own auto-generated docs don't surface this (another instance of the
`@ApiOperation` gap above — a hand-written `@ApiOperation` description
would be the natural place for this, once that decorator coverage
exists).

## Entity scoping

Most routes take an `entityId` (query param on `GET`s, body field on
`POST`/`PATCH`s) — this app is multi-entity, and a user's visibility into
a given entity's data is governed by row-level security scoped from their
own role assignments, not just the permission check above. Passing an
`entityId` the caller has no RLS visibility into returns an empty
result or a `404`, not a `403` — confirmed as the general pattern across
the modules this session has touched directly (Accounts Payable, HSE,
Workflow), not verified against all 82 controllers individually.

## Error shape

Every unhandled or thrown exception is normalized by a single global
filter (confirmed directly, `AllExceptionsFilter`) to:

```json
{
  "statusCode": 400,
  "path": "/api/v1/...",
  "timestamp": "2026-08-05T00:00:00.000Z",
  "message": "..."
}
```

`message` is either a string or, for `class-validator` failures, an
array of per-field validation messages (Nest's own default
`ValidationPipe` shape, passed through as-is). Non-`HttpException` errors
(genuine bugs, not validation/permission/not-found cases) are logged
server-side with a full stack trace and returned to the caller as a
generic `"Internal server error"` — the real cause is never leaked in
the response body.

## What this guide does not cover

Per-route request/response examples beyond what Swagger's own DTO-driven
schema already generates — the `@ApiOperation` gap above is the concrete,
scoped next step for that, not more hand-written prose here duplicating
what decorator coverage would generate automatically and keep in sync
with the code.
