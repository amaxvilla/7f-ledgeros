'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { tokens } from '@7f/ui';

interface Entity {
  id: string;
  code: string;
  name: string;
  legalName?: string;
  baseCurrency?: string;
  isActive: boolean;
  isConsolidationParent?: boolean;
}

interface EntitySelectorProps {
  initialValue?: string;
}

export function EntitySelector({ initialValue }: EntitySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [entities, setEntities] = React.useState<Entity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = React.useState(initialValue ?? '');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const redirectedRef = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;

    async function loadEntities() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/entities', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(
            body || `Failed to load entities (${response.status}).`,
          );
        }

        const data = (await response.json()) as Entity[];

        if (cancelled) {
          return;
        }

        setEntities(data);

        const currentId =
          initialValue && data.some((entity) => entity.id === initialValue)
            ? initialValue
            : '';

        if (currentId) {
          setSelectedEntityId(currentId);
          return;
        }

        /*
         * No entity was supplied in the URL.
         *
         * Prefer the previously selected entity from localStorage.
         * If it no longer exists, fall back to the first active entity.
         */
        let rememberedId = '';

        try {
          const stored = window.localStorage.getItem(
            'ledgeros-selected-entity-id',
          );

          if (stored && data.some((entity) => entity.id === stored)) {
            rememberedId = stored;
          }
        } catch {
          // localStorage can be unavailable in privacy-restricted browsers.
        }

        const nextEntityId = rememberedId || data[0]?.id || '';

        if (!nextEntityId || redirectedRef.current) {
          setSelectedEntityId(nextEntityId);
          return;
        }

        redirectedRef.current = true;
        setSelectedEntityId(nextEntityId);

        try {
          window.localStorage.setItem(
            'ledgeros-selected-entity-id',
            nextEntityId,
          );
        } catch {
          // Persistence is optional. URL selection still works.
        }

        const params = new URLSearchParams(searchParams.toString());
        params.set('entityId', nextEntityId);

        router.replace(
          `${pathname}?${params.toString()}`,
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load entities.',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadEntities();

    return () => {
      cancelled = true;
    };
  }, [initialValue, pathname, router, searchParams]);

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextEntityId = event.target.value;

    setSelectedEntityId(nextEntityId);

    if (!nextEntityId) {
      return;
    }

    try {
      window.localStorage.setItem(
        'ledgeros-selected-entity-id',
        nextEntityId,
      );
    } catch {
      // URL navigation remains the source of truth for the current page.
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('entityId', nextEntityId);

    router.push(
      `${pathname}?${params.toString()}`,
    );
  }

  const selectedEntity = entities.find(
    (entity) => entity.id === selectedEntityId,
  );

  return (
    <div
      style={{
        display: 'flex',
        gap: tokens.space(3),
        alignItems: 'center',
        marginBottom: tokens.space(6),
        flexWrap: 'wrap',
      }}
    >
      <label
        htmlFor="ledgeros-entity-selector"
        style={{
          fontFamily: tokens.font.body,
          fontSize: '13px',
          color: tokens.color.textMuted,
          fontWeight: 600,
        }}
      >
        Entity
      </label>

      <select
        id="ledgeros-entity-selector"
        value={selectedEntityId}
        onChange={handleChange}
        disabled={loading || entities.length === 0}
        style={{
          background: tokens.color.surfaceRaised,
          border: `1px solid ${tokens.color.border}`,
          borderRadius: tokens.radius.sm,
          color: tokens.color.textPrimary,
          padding: `${tokens.space(2)} ${tokens.space(3)}`,
          fontFamily: tokens.font.body,
          fontSize: '13px',
          minWidth: '320px',
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading && <option value="">Loading entities...</option>}

        {!loading && entities.length === 0 && (
          <option value="">No active entities available</option>
        )}

        {!loading &&
          entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.code} — {entity.name}
            </option>
          ))}
      </select>

      {selectedEntity && (
        <span
          style={{
            fontFamily: tokens.font.body,
            fontSize: '12px',
            color: tokens.color.textMuted,
          }}
        >
          {selectedEntity.legalName || selectedEntity.name}
        </span>
      )}

      {error && (
        <span
          role="alert"
          style={{
            fontFamily: tokens.font.body,
            fontSize: '12px',
            color: tokens.color.negative,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
