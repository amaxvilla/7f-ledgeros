'use client';

import * as React from 'react';
import { tokens } from '../tokens';

export interface ActionFormProps {
  /**
   * A Server Action reference, called with this form's own `FormData`
   * on submit — the same contract a native `<form action={fn}>` would
   * have. Called from an `onSubmit` handler instead of the `action` DOM
   * attribute directly, for the exact reason `LogoutButton`'s own doc
   * comment already established: form-action-as-a-function is a React
   * 19 feature, and this package's `react`/`react-dom` are pinned at
   * `^18.3.1` — a plain `<form action={someAsyncFn}>` triggers "Invalid
   * value for prop 'action'" at render time under that version. That
   * fix was written once for `LogoutButton`'s own zero-argument
   * `onLogout`; this component generalizes the same fix for any
   * `FormData`-taking (optionally `.bind(null, id)`-partially-applied)
   * action, since five real call sites hit the identical problem at
   * once (`api-gateway/page.tsx`'s `revokeApiKey`, `my-security/page.tsx`'s
   * `revokeOtherSessions`/`revokeSession`/`renameDevice`/`revokeDevice`)
   * — well past the "build the simplest version, let a second real
   * consumer justify extracting a shared component" bar `Select`'s own
   * doc comment sets, so a shared primitive is written now rather than
   * five near-identical one-off wrappers.
   *
   * Return `{ ok: false, error }` to surface an inline error below the
   * form — the same state-object shape every action in this app already
   * returns (`RevokeApiKeyState`, `RevokeActionState`, etc.). Returning
   * `{ ok: true }`, returning nothing, or resolving `void` are all
   * treated as success and left unhandled here — same as `LogoutButton`,
   * this component has no success-side effect of its own to run,
   * because the action's own `revalidatePath` call (every one of the
   * five call sites already has one) is what actually updates the page;
   * Next.js refreshes the calling route after any Server Action
   * resolves, whether it was invoked via a form's `action` attribute or
   * called directly from a Client Component the way this does — that
   * part of the mechanism doesn't depend on which of the two triggered
   * the call.
   */
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Disables every field/button inside the form while its own submission
 * is in flight — callers don't each need their own `disabled={pending}`
 * wiring the way every `Create*Form`/`Edit*Form` in this app manages
 * for themselves; this component's own call sites are all short-lived
 * table-row actions (revoke/rename), not multi-field data-entry forms
 * with their own independent pending-state needs the way those are.
 *
 * Tracks pending state with plain `useState`, not `LogoutButton`'s own
 * `useTransition` — confirmed directly, not assumed, that
 * `useTransition`'s `isPending` doesn't reliably reflect an async
 * callback's real duration under React 18 (this package's pinned
 * version): a test asserting the submit button is disabled while the
 * action's promise is still unresolved failed against a `useTransition`
 * version of this component, because React 18 only tracks the
 * *synchronous* portion of a transition callback as "pending" — the
 * `await` inside an async callback happens after that synchronous
 * portion has already finished, so `isPending` had already flipped back
 * to `false` by the time the test could observe it. `LogoutButton`
 * never had a test asserting this same thing, which is why this gap
 * wasn't caught there.
 */
export function ActionForm({ action, children, style }: ActionFormProps) {
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setIsPending(true);
        const formData = new FormData(e.currentTarget);
        try {
          const result = await action(formData);
          if (result && result.ok === false) {
            setError(result.error ?? 'Action failed.');
          }
        } finally {
          setIsPending(false);
        }
      }}
      style={style}
      aria-busy={isPending}
    >
      <fieldset disabled={isPending} style={{ border: 'none', margin: 0, padding: 0, display: 'contents' }}>
        {children}
      </fieldset>
      {error && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '12px', marginTop: tokens.space(1) }}>
          {error}
        </div>
      )}
    </form>
  );
}
