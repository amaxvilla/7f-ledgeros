import * as React from 'react';
import { tokens } from '../tokens';

/**
 * Frontend Completion, Checkpoint Q — the first reusable form primitives
 * in this package. Every page built through Checkpoint P has been
 * read-only; EntitySelector (apps/web/app/EntitySelector.tsx) is the
 * one existing exception, but it's page-local (a GET-method form for
 * URL search params, not a POST-submitting data-entry form) and its
 * input/button styling was never extracted into @7f/ui — this
 * checkpoint extracts that exact same visual language (see
 * EntitySelector's own <input>/<button> styles, which these two
 * components deliberately match) into reusable, typed components so
 * every future form checkpoint styles itself identically without
 * copy-pasting inline style objects.
 *
 * Deliberately NOT a full form-library abstraction (no validation
 * schema integration, no field-array support) — just the two visual
 * primitives every simple create/update form needs. A more complex form
 * checkpoint later can build on top of these without this checkpoint
 * having guessed wrong about what that complexity should look like.
 *
 * ADDENDUM (FE-10.7) — Accessibility. `error` has driven a visual
 * change (the negative-toned border) since this file's own first
 * checkpoint, and FE-10.5/FE-10.6 wired real per-field messages through
 * it into four forms — but nothing here ever told a screen reader
 * about either the invalid state or the message. A sighted person
 * validating `CreateLeadForm` sees a red border and reads "First name
 * is required" right below it; a screen-reader user tabbing to that
 * same input, before this checkpoint, heard only the label — the error
 * text existed in the DOM but was never programmatically associated
 * with the control that caused it. Fixed by setting `aria-invalid` and
 * `aria-describedby` on the input/select itself (pointing at the error
 * `<span>`'s own new `id`) only when `error` is actually set — an
 * unset `error` leaves both attributes absent entirely, not `false`/
 * empty-string, matching this component's own existing "no error prop,
 * no error span at all" posture. The error `<span>` also gets
 * `role="alert"` so assistive technology announces it as soon as it
 * appears (e.g. right after a blocked submit), not only if the user
 * happens to tab back to the field afterward.
 */
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, id, style, ...inputProps },
  ref,
) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
      <label htmlFor={inputId} style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
        {label}
      </label>
      <input
        {...inputProps}
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        style={{
          background: tokens.color.surfaceRaised,
          border: `1px solid ${error ? tokens.color.negative : tokens.color.border}`,
          borderRadius: tokens.radius.sm,
          color: tokens.color.textPrimary,
          padding: `${tokens.space(3)} ${tokens.space(3)}`,
          fontFamily: tokens.font.mono,
          fontSize: '16px',
          ...style,
        }}
      />
      {error && (
        <span id={errorId} role="alert" style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.negative }}>
          {error}
        </span>
      )}
    </div>
  );
});

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  options: SelectOption[];
  /** Rendered as a disabled, unselectable first option — e.g. "Select a type…". Omit for a select where the first real option is a reasonable default. */
  placeholder?: string;
  /** Shown, in place of the (otherwise unusable) empty dropdown, when `options` is empty. Mirrors DataTable's own `emptyMessage` convention. */
  emptyMessage?: string;
  error?: string;
}

/**
 * Frontend Completion — first Select/dropdown primitive in this
 * package, following TextField's own established shape exactly (same
 * label/error/id-generation conventions, same style-merge pattern via
 * `...style`). Fills the gap TextField's own doc comment named:
 * CreateLeadForm's `source` field and CreateTaxCodeForm's `taxType`
 * field were both "the simplest correct version of a field" — a plain
 * text input standing in for what's actually a small, fixed set of
 * values — specifically BECAUSE this component didn't exist yet. Both
 * of those forms' own doc comments explicitly named this exact
 * component as the thing that would let them "upgrade this field
 * without touching this form's submit logic" — true here: Select's
 * value/onChange contract is identical to a native `<select>`'s (this
 * IS a native `<select>`, styled), so an existing `useState<string>` +
 * `onChange={(e) => setX(e.target.value)}` pair swaps from TextField to
 * Select with no other change to the surrounding form.
 *
 * options is a plain caller-supplied array, not a fetched/async list —
 * this component has no data-fetching concern of its own. A future
 * checkpoint wiring a dynamic option set (e.g. AssetCategory options
 * fetched from `GET /fixed-assets/categories` for
 * CreateFixedAssetForm's own `assetCategoryId` field, flagged in that
 * form's own doc comment) fetches in its own Server Component and
 * passes the resulting array down — Select itself stays exactly this
 * simple either way.
 *
 * ADDENDUM (FE-10.2) — Empty States. `options.length === 0` used to
 * render a genuinely blank, unusable `<select>` (zero `<option>`
 * elements, or just the `placeholder` forever if one was given) — a
 * real, universal gap distinct from `DataTable`'s own already-handled
 * empty case (confirmed directly: `DataTable` has had a working
 * `emptyMessage` default since Checkpoint F). Concretely hit by, among
 * others, `CreateEntityForm`'s own `parentOptions` (empty on a fresh
 * install with zero entities) and `AddDependencyForm`'s own
 * `taskOptions` (empty on a project with only one task). Fixed HERE,
 * once, in the shared primitive — not per-consuming-form — the same
 * "fix a primitive once, not each caller" scope this checkpoint's own
 * `Toast.tsx` sibling took toward a different gap last checkpoint.
 *
 * When empty, the interactive `<select>` is replaced entirely with a
 * disabled, muted, DataTable-empty-state-styled message — NOT a
 * `<select disabled>` with a single fake option, and NOT left
 * interactive with `required` still set. A `required` native `<select>`
 * with no selectable option would trap native browser validation in an
 * impossible state (the user can never satisfy "please select an
 * option" when there is nothing to select) — replacing the control
 * entirely avoids that trap and matches how `DataTable` itself already
 * treats a genuinely empty dataset (replace the interactive element,
 * don't render a broken one). The field's own `<label>` is still
 * rendered above the message, so the empty state still reads in
 * context rather than as an unexplained blank gap in the form layout.
 *
 * ADDENDUM (FE-10.7) — Accessibility. Two fixes, same theme as
 * `TextField`'s own FE-10.7 addendum:
 *
 * 1. Same `aria-invalid`/`aria-describedby` wiring on the `<select>`
 *    itself, and `role="alert"` on the error `<span>`, for the exact
 *    same "error was visual-only, never announced" reason.
 * 2. A real, pre-existing bug in the empty-options branch: `<label
 *    htmlFor={selectId}>` pointed at the empty-state `<div id=
 *    {selectId}>`, but a `<label for>` only creates a real
 *    accessibility-tree association for a labelable element (input,
 *    select, textarea, button, meter, output, progress) — a `<div>`
 *    isn't one, so browsers and assistive tech never actually
 *    associated the label with it despite the matching ids (confirmed
 *    directly: this exact gap was silently failing `Form.test.tsx`'s
 *    own "still associates the label... via htmlFor/id" test the
 *    entire time, an existing failure this checkpoint's own
 *    before-coding pass found, not introduced). Fixed by adding
 *    `aria-labelledby` (pointing at the label's own new `id`) to the
 *    empty-state `<div>` — `getByLabelText` and real assistive tech
 *    both recognize `aria-labelledby` on any element, labelable or
 *    not, unlike `label[for]`. `htmlFor` itself stays on the label
 *    unchanged (harmless when the target isn't labelable; still
 *    correct and load-bearing for the real `<select>` branch).
 *
 * ADDENDUM (FC-4, Mobile Responsiveness — continuing `DataTable`'s own
 * audit from this stage's first checkpoint into the next most-reused
 * shared shapes, forms and buttons) — two real, distinct issues, not
 * one:
 *
 * 1. `TextField`'s `<input>` and `Select`'s `<select>` both had
 *    `fontSize: '13px'`. Below 16px, iOS Safari forcibly zooms the
 *    whole viewport in when the control receives focus — a specific,
 *    well-documented WebKit behavior (not the softer 44px touch-target
 *    guideline `DataTable`'s own audit weighed), present on every
 *    single form input in this app before this fix. Raised to 16px on
 *    both.
 * 2. Touch-target height: same modest, non-redesigning bump `DataTable`
 *    took (`space(2)` → `space(3)` vertical padding, 8px → 12px) applied
 *    here to `TextField`/`Select`'s own input chrome AND to `Button`'s
 *    own padding — Button is the PRIMARY submit control of every form
 *    in this app, a more load-bearing target than the small per-row
 *    action buttons `DataTable`'s own audit named and deliberately left
 *    unfixed. `Button`'s `fontSize` was left at 13px — the iOS
 *    auto-zoom behavior is specific to text-entry controls
 *    (input/select/textarea), not buttons, confirmed against WebKit's
 *    own documented behavior before assuming Button needed the same
 *    two-part fix as the other two.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options, placeholder, emptyMessage = 'No options available.', error, id, style, ...selectProps },
  ref,
) {
  const selectId = id ?? `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const labelId = `${selectId}-label`;
  const errorId = `${selectId}-error`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(1) }}>
      <label
        id={labelId}
        htmlFor={selectId}
        style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}
      >
        {label}
      </label>
      {options.length === 0 ? (
        <div
          id={selectId}
          aria-labelledby={labelId}
          style={{
            padding: `${tokens.space(2)} ${tokens.space(3)}`,
            border: `1px solid ${tokens.color.border}`,
            borderRadius: tokens.radius.sm,
            color: tokens.color.textMuted,
            fontFamily: tokens.font.body,
            fontSize: '13px',
            ...style,
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        <select
          {...selectProps}
          id={selectId}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          style={{
            background: tokens.color.surfaceRaised,
            border: `1px solid ${error ? tokens.color.negative : tokens.color.border}`,
            borderRadius: tokens.radius.sm,
            color: tokens.color.textPrimary,
            padding: `${tokens.space(3)} ${tokens.space(3)}`,
            fontFamily: tokens.font.mono,
            fontSize: '16px',
            ...style,
          }}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
      {error && (
        <span id={errorId} role="alert" style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.negative }}>
          {error}
        </span>
      )}
    </div>
  );
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}
/** `disabled` doubles as the pending-submit indicator — callers pass `disabled={pending}` rather than this component tracking its own async state, since only the caller (the form) knows when a submission is actually in flight. */
export function Button({ variant = 'primary', style, children, ...buttonProps }: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <button
      {...buttonProps}
      style={{
        background: isPrimary ? tokens.color.accent : 'transparent',
        color: isPrimary ? tokens.color.bg : tokens.color.textPrimary,
        border: isPrimary ? 'none' : `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.sm,
        padding: `${tokens.space(3)} ${tokens.space(4)}`,
        fontFamily: tokens.font.body,
        fontSize: '13px',
        fontWeight: 600,
        cursor: buttonProps.disabled ? 'not-allowed' : 'pointer',
        opacity: buttonProps.disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
