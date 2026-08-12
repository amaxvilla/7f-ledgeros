'use client';

import { Button } from './Form';
import { ActionForm } from './ActionForm';

export interface LogoutButtonProps {
  /** A Server Action reference, passed down from the caller — see AppShellProps.onLogout's own doc comment for why this component takes it rather than importing any auth logic itself. */
  onLogout: () => Promise<void>;
}

/**
 * Frontend Completion, Checkpoint AL: fixed the React 18 vs 19
 * form-action problem by calling `onLogout` from an `onClick` handler
 * instead of the `<form action>` DOM attribute, using `useTransition`
 * to expose a pending state.
 *
 * De-duplication checkpoint (post Checkpoint fix1): re-implemented on
 * top of `ActionForm`, which fixes the identical React 18/19 problem
 * for its own five call sites (api-gateway/my-security) — see that
 * component's own doc comment for why it deliberately does NOT use
 * `useTransition` the way this component originally did: a real test
 * (asserting a submit button stays disabled while its action's promise
 * is still unresolved) failed against a `useTransition` version,
 * because React 18 only tracks a transition callback's *synchronous*
 * portion as pending — the `await` inside an async callback runs after
 * that portion has already finished, so `isPending` had already
 * flipped back to `false`. This component's own test suite (below)
 * never asserted that particular thing, which is why the gap went
 * unnoticed here; `ActionForm`'s `useState`-based pending tracking
 * doesn't have it, so reusing it fixes a latent bug in this component
 * as a side effect of removing the duplication, not just the
 * duplication itself.
 *
 * `onLogout` takes no arguments; `ActionForm`'s `action` prop expects
 * `(formData: FormData) => ...` — passing `onLogout` directly type-checks
 * as-is (a function accepting fewer parameters than a target function
 * type is always assignable to it), so no adapter wrapper is needed.
 */
export function LogoutButton({ onLogout }: LogoutButtonProps) {
  return (
    <ActionForm action={onLogout}>
      <Button type="submit" variant="secondary">
        Log out
      </Button>
    </ActionForm>
  );
}
