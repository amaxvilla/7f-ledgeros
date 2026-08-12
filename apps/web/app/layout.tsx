import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AppShell, ToastProvider } from '@7f/ui';
import { logout } from './login/actions';
import { markNotificationRead, markAllNotificationsRead } from './actions';
import { fetchApi } from '../lib/api';
import { decodeAccessTokenEmail } from '../lib/jwt';
import './globals.css';

export const metadata: Metadata = {
  title: '7F LedgerOS — Dashboard',
  description: 'Multi-entity financial operating system for 7Fifteen Capital Ltd',
};

interface MyNotificationsWidget {
  unreadCount: number;
  recent: { id: string; title: string; body: string; createdAt: string; readAt: string | null }[];
}

/**
 * Frontend Completion, Checkpoint AK — reads the `accessToken` cookie
 * (Checkpoint AI/AJ) directly here rather than adding any new
 * client-side session store: a root layout is a Server Component, so
 * this is a plain, synchronous `cookies()` read on every request (Next
 * automatically opts a route into dynamic rendering wherever `cookies()`
 * is called — no separate `export const dynamic` needed here, unlike
 * every page under app/*\/page.tsx, which sets it explicitly because
 * they call `fetchApi` instead).
 *
 * Presence of the cookie is treated as "logged in" — this does NOT
 * verify the token is still valid/unexpired (that's `JwtStrategy`'s job
 * on every actual API request); an expired-but-present cookie still
 * shows "Log out" here, same as it still gets sent as a bearer token by
 * `fetchApi` and just gets whatever 401 the backend returns, per
 * `lib/api.ts`'s own Checkpoint AJ doc comment.
 *
 * FE-1.2 — now also async: fetches `GET /dashboard/my-notifications`
 * (Release F, `NotificationsMenu`'s own doc comment) and decodes the
 * access token's email (`lib/jwt.ts`) whenever a token is present,
 * passing both down to `AppShell`. Both are wrapped in their own
 * try/catch and default to "nothing" on failure (`{unreadCount: 0,
 * recent: []}` / `undefined` email) — a chrome-level widget failing to
 * load must never take down every page in the app with it, the same
 * "degrade the chrome, not the page" posture this checkpoint's sibling
 * component doc comments (`NotificationsMenu`) already describe. This
 * is the ONE place in this app that calls `fetchApi` outside a route's
 * own `page.tsx` — deliberate, since notifications are chrome, not a
 * page's own data, and the root layout is the only Server Component
 * that wraps every route equally.
 *
 * ADDENDUM (FE-10.1) — wrapped `AppShell` in `ToastProvider` (see
 * `Toast.tsx`'s own doc comment). This is the only wiring change this
 * checkpoint makes here: `RootLayout` itself stays a Server Component,
 * and `ToastProvider` — a Client Component — is simply rendered as its
 * child, the same way `AppShell` already was.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const accessToken = cookies().get('accessToken')?.value;
  const isLoggedIn = Boolean(accessToken);

  let notifications: MyNotificationsWidget | undefined;
  let userEmail: string | undefined;

  if (accessToken) {
    userEmail = decodeAccessTokenEmail(accessToken) ?? undefined;
    try {
      notifications = await fetchApi<MyNotificationsWidget>('/dashboard/my-notifications');
    } catch {
      notifications = { unreadCount: 0, recent: [] };
    }
  }

  return (
    <html lang="en">
      <head>
        {/*
          FE-1.6 — Theme (light/dark toggle). A small, synchronous,
          blocking inline script (the standard Next.js/React pattern for
          this — not a hydration-order Client Component effect, which
          would run after first paint) so a returning visitor who chose
          light mode doesn't see a flash of the dark default before
          `ThemeToggle.tsx`'s own `useEffect` gets a chance to run.
          Wrapped in try/catch: `localStorage` can throw in some
          privacy-mode browsers, and a theme flash is a strictly better
          failure than breaking the page over it — degrades to the dark
          default silently, same "chrome failing must never take the
          page down with it" posture `layout.tsx`'s own notifications
          fetch already follows above. Reads the exact same
          `localStorage` key (`ledgeros-theme`) `ThemeToggle.tsx` itself
          writes — kept as a literal here rather than importing from
          `@7f/ui`, since an inline `<script>`'s content can't import a
          module.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('ledgeros-theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}",
          }}
        />
      </head>
      <body>
        <ToastProvider>
          <AppShell
            isLoggedIn={isLoggedIn}
            onLogout={logout}
            userEmail={userEmail}
            notifications={notifications}
            onMarkNotificationRead={markNotificationRead}
            onMarkAllNotificationsRead={markAllNotificationsRead}
          >
            {children}
          </AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
