import { tokens } from '../tokens';

export interface KpiCardProps {
  label: string;
  value: string;
  caption?: string;
  tone?: 'neutral' | 'positive' | 'negative' | 'warning';
  asOf?: string;
}

const toneColor: Record<NonNullable<KpiCardProps['tone']>, string> = {
  neutral: tokens.color.textPrimary,
  positive: tokens.color.positive,
  negative: tokens.color.negative,
  warning: tokens.color.warning,
};

/** A single ledger-index-card KPI tile: label, big mono figure, small caption. */
export function KpiCard({ label, value, caption, tone = 'neutral', asOf }: KpiCardProps) {
  return (
    <div
      style={{
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
        padding: tokens.space(5),
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(2),
        minWidth: '200px',
      }}
    >
      <span
        style={{
          fontFamily: tokens.font.body,
          fontSize: '12px',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: tokens.color.textMuted,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: tokens.font.mono,
          fontVariantNumeric: 'tabular-nums',
          fontSize: '28px',
          fontWeight: 600,
          color: toneColor[tone],
        }}
      >
        {value}
      </span>
      {(caption || asOf) && (
        <span style={{ fontFamily: tokens.font.body, fontSize: '12px', color: tokens.color.textMuted }}>
          {caption}
          {caption && asOf ? ' · ' : ''}
          {asOf ? `as of ${asOf}` : ''}
        </span>
      )}
    </div>
  );
}
