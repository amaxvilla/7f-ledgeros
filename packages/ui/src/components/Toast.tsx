'use client';

import * as React from 'react';
import { tokens } from '../tokens';

export type ToastTone = 'positive' | 'negative' | 'neutral';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

const TONE_COLOR: Record<ToastTone, string> = {
  positive: tokens.color.positive,
  negative: tokens.color.negative,
  neutral: tokens.color.accent,
};

const AUTO_DISMISS_MS = 5000;

/**
 * Frontend Completion, FE-10.1 — Toast Notifications, first checkpoint
 * of Stage FE-10 (UX Polish). Before building: every mutating action in
 * this app so far (dozens of `Create*Form`/`*StatusActions` components
 * across every stage) surfaces success/failure as inline text next to
 * the triggering form — a real, working pattern, but genuinely never a
 * SHARED, ambient one; there is no toast primitive anywhere in
 * `packages/ui` or `apps/web` (confirmed directly — no grep hit for
 * "Toast" anywhere in either tree before this file). This checkpoint
 * builds that primitive; it deliberately does NOT retrofit the dozens
 * of existing inline-message components to use it instead — that's a
 * much larger, separate effort (every one of those inline messages
 * still works correctly on its own) and not what "add a missing
 * primitive" means here. `admin-tools/FlagOverdueForm.tsx` is updated
 * to also call `showToast` alongside its own existing inline message,
 * as a single real, working demonstration of the primitive — not a
 * sweeping adoption pass.
 *
 * Context + a fixed-position stack, not a third-party toast library:
 * this app has no such dependency anywhere, and the requirement here —
 * a queue of auto-dismissing messages, positioned once, above
 * everything else — doesn't need one. Each toast auto-dismisses after
 * `AUTO_DISMISS_MS` (5s) via its own `setTimeout`, cleaned up on
 * unmount; there is no manual close button — every toast is transient
 * by design, the same "don't make chrome the user must act on" posture
 * `NotificationsMenu`'s own doc comment takes for chrome-level widgets
 * degrading gracefully rather than demanding interaction.
 *
 * `ToastProvider` wraps `{children}` inside the ROOT layout (a Server
 * Component), same as `AppShell` itself — a Server Component can render
 * a Client Component as its child directly, so no extra wiring was
 * needed beyond importing this one alongside `AppShell` in
 * `layout.tsx`.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const nextId = React.useRef(0);

  const showToast = React.useCallback((message: string, tone: ToastTone = 'neutral') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const value = React.useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: tokens.space(6),
          right: tokens.space(6),
          display: 'flex',
          flexDirection: 'column',
          gap: tokens.space(2),
          zIndex: 1000,
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            style={{
              background: tokens.color.surfaceRaised,
              border: `1px solid ${TONE_COLOR[t.tone]}`,
              borderRadius: tokens.radius.md,
              padding: `${tokens.space(3)} ${tokens.space(4)}`,
              fontFamily: tokens.font.body,
              fontSize: '13px',
              color: tokens.color.textPrimary,
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
              minWidth: '240px',
              maxWidth: '360px',
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Returns `{ showToast }` if a `ToastProvider` is present, or a no-op
 * `showToast` otherwise — the same "degrade gracefully, never throw"
 * posture the rest of this app's chrome-level pieces take, so a
 * component that calls this hook never crashes a page that (for
 * whatever reason) doesn't have the provider mounted above it.
 */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  return ctx ?? { showToast: () => {} };
}
