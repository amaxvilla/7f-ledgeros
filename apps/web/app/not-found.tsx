import { tokens } from '@7f/ui';

/**
 * Frontend Completion, Checkpoint A. Next.js App Router special file —
 * rendered for any route that doesn't match a page. Replaces Next.js's
 * own default unstyled 404. (Originally written when `/` was this
 * app's only real route; `/recruitment` and `/payments` exist now too,
 * as of Checkpoints B/C — this file's behavior needs no change for
 * that, since it already covers "anything unmatched" generically rather
 * than naming specific routes.)
 */
export default function NotFound() {
  return (
    <main style={{ padding: tokens.space(8), maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <h1
        style={{
          fontFamily: tokens.font.display,
          fontSize: '22px',
          color: tokens.color.textPrimary,
          borderLeft: `3px solid ${tokens.color.accent}`,
          paddingLeft: tokens.space(3),
          textAlign: 'left',
        }}
      >
        Page not found
      </h1>
      <p style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted, textAlign: 'left' }}>
        The page you're looking for doesn't exist.{' '}
        <a href="/" style={{ color: tokens.color.accent }}>
          Return to the dashboard
        </a>
        .
      </p>
    </main>
  );
}
