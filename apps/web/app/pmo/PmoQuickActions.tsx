'use client';

import Link from 'next/link';
import { tokens } from '@7f/ui';

interface PmoQuickActionsProps {
  entityId: string;
  projectId: string;
}

export function PmoQuickActions({
  entityId,
  projectId,
}: PmoQuickActionsProps) {
  const query = `?entityId=${encodeURIComponent(entityId)}&projectId=${encodeURIComponent(projectId)}`;

  const links = [
    { label: 'Tasks', href: `/project-tasks${query}` },
    { label: 'Risks', href: `/project-risks${query}` },
    { label: 'Issues', href: `/project-issues${query}` },
    { label: 'Resources', href: `/project-resources${query}` },
    { label: 'BOQ', href: `/boq${query}` },
    { label: 'Work Packages', href: `/work-packages${query}` },
  ];

  return (
    <section style={{ marginBottom: tokens.space(8) }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.space(4),
          marginBottom: tokens.space(4),
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: tokens.font.display,
              fontSize: '1.125rem',
            }}
          >
            Project Controls
          </h2>
          <p
            style={{
              margin: `${tokens.space(2)} 0 0`,
              color: tokens.color.textMuted,
              fontFamily: tokens.font.body,
            }}
          >
            Manage the operational areas of this project.
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: tokens.space(3),
        }}
      >
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              boxSizing: 'border-box',
              background: tokens.color.accent,
              color: tokens.color.bg,
              border: 'none',
              borderRadius: tokens.radius.sm,
              padding: `${tokens.space(3)} ${tokens.space(4)}`,
              fontFamily: tokens.font.body,
              fontSize: '13px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
