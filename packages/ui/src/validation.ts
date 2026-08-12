/**
 * Frontend Completion, FE-10.5 — UX Polish: Validation.
 *
 * Before writing anything, checked what already existed: every
 * data-entry form built since Checkpoint Q (CreateTenantForm) validates
 * exactly one thing client-side — the native `required` attribute on
 * `TextField`/`Select` — and otherwise submits straight to its Server
 * Action, discovering any other problem (a malformed email, a blank
 * that only has whitespace in it) only from whatever error message the
 * API happens to return, if it validates that field at all server-side.
 * `TextField` and `Select` (packages/ui/src/components/Form.tsx) have
 * both had a typed `error?: string` prop since Checkpoint Q itself, but
 * grepping every consuming form confirms not one of them has ever set
 * it from anything other than a whole-form API-error string rendered
 * separately below the fields — the prop this checkpoint's two
 * consuming forms are the first to actually populate per-field.
 *
 * THE GAP: no shared way for a 'use client' form to check its own
 * fields before it ever calls a Server Action, so a required-but-blank
 * field, or a syntactically-invalid email, only surfaces after a round
 * trip to the API — slower feedback than a purely client-side check
 * could give, and inconsistent with which fields the backend happens to
 * validate at all.
 *
 * Deliberately a small set of plain functions, not a schema library or
 * a `useForm` hook — this codebase has no form-library dependency
 * anywhere (Form.tsx's own doc comment calls that out as a deliberate
 * choice for TextField/Select themselves) and introducing one just for
 * validation would be a much bigger footprint than this gap calls for.
 * `validateForm` returns a plain `Record<field, message>` that a form's
 * own existing `useState` + JSX already knows how to consume via the
 * `error` prop it's had all along — no new state-management shape, no
 * new dependency.
 *
 * Each validator only reports on a value that's actually present -
 * `email`/`phone` both treat an empty string as valid so they compose
 * with an *optional* field exactly as well as a required one: pair
 * `required()` with `email()` for a mandatory email field, or use
 * `email()` alone for the "Email (optional)" shape both of this
 * checkpoint's forms already have.
 *
 * ADDENDUM (FE-10.6) — rolled out to a second pair of forms
 * (`CreateTenantForm`, `CreateVendorForm`); `uuid()` added below for
 * `CreateTenantForm`'s own `customerId`/`unitId` plain-text-UUID
 * fields, the first validator this module didn't already need for its
 * first two consuming forms.
 */

export type FieldValidator = (value: string) => string | undefined;

/** Fails only on an empty or whitespace-only value. Whitespace-only is treated as blank, not as "not empty" — a name field of only spaces isn't a real name. */
export function required(message = 'This field is required'): FieldValidator {
  return (value) => (value.trim() === '' ? message : undefined);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Passes on blank (see module doc comment) so this composes with an optional field; pair with `required()` to make the field itself mandatory. */
export function email(message = 'Enter a valid email address'): FieldValidator {
  return (value) => {
    if (value.trim() === '') return undefined;
    return EMAIL_PATTERN.test(value.trim()) ? undefined : message;
  };
}

// Deliberately loose: digits, spaces, and the punctuation real phone
// numbers already use in this app's own seed/test data (+2348012345678,
// (02) 123-4567) — this is a "did you fat-finger this field" check, not
// a carrier-verified E.164 validator.
const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;

/** Passes on blank (see module doc comment) so this composes with an optional field. */
export function phone(message = 'Enter a valid phone number'): FieldValidator {
  return (value) => {
    if (value.trim() === '') return undefined;
    return PHONE_PATTERN.test(value.trim()) ? undefined : message;
  };
}

/** Fails only once a non-blank value is shorter than `min` — an empty optional field is left to `required()` (or left valid, if the field really is optional) rather than this also demanding a minimum on nothing. */
export function minLength(min: number, message = `Must be at least ${min} characters`): FieldValidator {
  return (value) => {
    if (value.trim() === '') return undefined;
    return value.trim().length >= min ? undefined : message;
  };
}

// Every id column in prisma/schema.prisma uses `@default(uuid())` (confirmed
// directly, not assumed) — this matches any UUID version/variant rather than
// pinning to v4 specifically, since Prisma's own `uuid()` default isn't
// documented as guaranteeing one particular version.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * FE-10.6 addition — for the plain-`TextField`-standing-in-for-a-picker
 * id fields this app already has several of (`CreateTenantForm`'s own
 * `customerId`/`unitId`, both explicitly documented there as "PLAIN TEXT
 * INPUTS for real UUIDs... a deliberate, documented simplification").
 * Passes on blank so this composes with an optional id field the same
 * way `email`/`phone` do; pair with `required()` to make the field
 * itself mandatory.
 */
export function uuid(message = 'Enter a valid ID (expected a UUID)'): FieldValidator {
  return (value) => {
    if (value.trim() === '') return undefined;
    return UUID_PATTERN.test(value.trim()) ? undefined : message;
  };
}

/**
 * Runs each field's validators in order and stops at the first failure
 * per field (matching how a person reads one error at a time, not a
 * stacked list for a single input) — the same "first problem wins"
 * shape `ApiError` already gives a form for a whole-form failure.
 */
export function validateForm<T extends Record<string, string>>(
  values: T,
  schema: Partial<Record<keyof T, FieldValidator[]>>,
): Partial<Record<keyof T, string>> {
  const errors: Partial<Record<keyof T, string>> = {};
  for (const key of Object.keys(schema) as (keyof T)[]) {
    const validators = schema[key];
    if (!validators) continue;
    for (const validate of validators) {
      const message = validate(values[key] ?? '');
      if (message) {
        errors[key] = message;
        break;
      }
    }
  }
  return errors;
}
