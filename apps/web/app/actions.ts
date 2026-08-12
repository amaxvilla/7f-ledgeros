'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../lib/api';

export interface NotificationActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-1.2 — root-level (not route-scoped) Server
 * Actions, since `NotificationsMenu` renders inside `AppShell`/
 * `layout.tsx`, not any one route's own `page.tsx`. Every other
 * `actions.ts` in this app lives under the one route it serves
 * (`app/payments/actions.ts`, etc.); this is the first piece of chrome
 * that needs one of its own, so it lives at `app/actions.ts` rather than
 * being force-fit under an unrelated route.
 *
 * `revalidatePath('/', 'layout')` (not a specific route's own path) —
 * the root layout renders on every route, so a plain `revalidatePath('/')`
 * would only invalidate the `/` route segment's own cache, not the
 * shared layout every other page also renders through. Confirmed this
 * is what Next's own `revalidatePath` second-argument type
 * (`'layout' | 'page'`) is for, rather than guessing at a workaround.
 */
export async function markNotificationRead(id: string): Promise<NotificationActionState> {
  try {
    await fetchApi(`/notifications/${id}/read`, { method: 'PATCH' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to mark notification read.' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function markAllNotificationsRead(): Promise<NotificationActionState> {
  try {
    await fetchApi('/notifications/read-all', { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to mark all notifications read.' };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
