import { Injectable } from '@nestjs/common';
import { PresenceProviderRegistry } from './presence-provider.registry';

/**
 * Release IG.1, Checkpoint P.
 *
 * The piece PresenceProviderRegistry and MicrosoftGraphPresenceProvider
 * were missing: something that actually calls getPresence. Mirrors
 * ContactsService/TasksService/TeamsService exactly, including their
 * scope decision: no Prisma persistence, and no opinion on which of
 * this codebase's screens should actually show a presence indicator —
 * presence-provider.interface.ts's own design notes explicitly defer
 * that decision to whichever future caller needs it. This layer only
 * makes getPresence callable at all.
 *
 * Simpler than its siblings in one respect: PresenceProvider has a
 * single read-only method with no Date-typed fields to convert at this
 * boundary (unlike CalendarService/TasksService/TeamsService's own
 * startTime/endTime/dueDateTime conversions), so there's nothing for
 * this service to do beyond the registry lookup itself — kept as its
 * own thin method regardless, rather than having callers reach
 * PresenceProviderRegistry directly, for the same reason every sibling
 * service exists: one place to add caching, RLS, or a Prisma-backed
 * cache-table later without every caller needing to change.
 */
@Injectable()
export class PresenceService {
  constructor(private readonly registry: PresenceProviderRegistry) {}

  getPresence(providerCode: string, userIdentifier: string) {
    return this.registry.get(providerCode).getPresence(userIdentifier);
  }
}
