'use client';

import * as React from 'react';
import { Button, Select, TextField, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { subdivideParcel } from './actions';

interface PlotLine {
  plotNumber: string;
  areaSqm: string;
  useType: string;
  notes: string;
}

const EMPTY_PLOT: PlotLine = { plotNumber: '', areaSqm: '', useType: '', notes: '' };

const USE_TYPE_OPTIONS = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'MIXED_USE', label: 'Mixed use' },
  { value: 'INDUSTRIAL', label: 'Industrial' },
  { value: 'AGRICULTURAL', label: 'Agricultural' },
];

/**
 * Frontend Completion, FE-4.4 — Plots, FE-4.3's own recommended direct
 * continuation, and the first Land Bank sub-resource that depends on
 * another one already built in this app (a `surveyPlanId`).
 *
 * Reuses `CreateBoqForm`'s own dynamic add/remove-line pattern directly
 * for `plots` — `LandBankService.subdivideParcel` throws
 * `BadRequestException` on an empty array (confirmed directly), the
 * same "at least one line" rule `CreateBoqForm`'s own `lines` already
 * enforces the identical way (a manual check, since `SubdivideParcelDto`
 * uses `@ArrayMinSize(1)` server-side but nothing stops an empty
 * submission from this form other than starting with one row and never
 * letting the count reach zero — `removeLine`'s own `disabled={lines.length
 * === 1}` guard, copied from `CreateBoqForm` unchanged).
 *
 * `surveyPlanId` is a real `Select`, built from `parcel.surveyPlans`
 * (already fetched by `page.tsx`, passed down as `surveyPlanOptions` —
 * same "fetch in the Server Component, pass the array down" shape
 * `CreateBoqForm`'s own `projectOptions` already established) —
 * FILTERED TO `APPROVED` ONLY. Confirmed directly:
 * `subdivideParcel` throws `BadRequestException` ("Parcel can only be
 * subdivided against an approved survey plan") for any other status,
 * so offering a `DRAFT`/`SUBMITTED`/`REJECTED` plan in this dropdown
 * would only ever produce a guaranteed-failing submit — same "don't
 * offer what would always fail" posture used throughout this app.
 *
 * `useType` is a real `Select` (`PlotUseType`, 5 values, confirmed
 * directly against `schema.prisma`) that starts on its placeholder and
 * submits `undefined` when left there, letting `Plot.useType`'s own
 * Prisma `@default(RESIDENTIAL)` apply — same convention every other
 * optional-enum-with-a-server-default field in this app already uses.
 *
 * Total plot area vs. parcel area is a server-side check only
 * (`BadRequestException` if the sum exceeds `parcel.areaSqm`) — NOT
 * duplicated client-side; this form doesn't even receive the parcel's
 * own area as a prop, since re-deriving and racing the same check the
 * backend already owns authoritatively would be redundant, not helpful.
 *
 * ADDENDUM (FE-10.31, Mobile Responsiveness rollout) — both `Button`
 * usages' own compact `style` override removed (Remove/+ Add plot),
 * the same fix this rollout has now applied to every dynamic
 * line-item form across the app. Verified directly against this
 * file's own current source before fixing.
 */
export function SubdividePlotsForm({ parcelId, surveyPlanOptions }: { parcelId: string; surveyPlanOptions: SelectOption[] }) {
  const [surveyPlanId, setSurveyPlanId] = React.useState('');
  const [plots, setPlots] = React.useState<PlotLine[]>([{ ...EMPTY_PLOT }]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function updatePlot(index: number, field: keyof PlotLine, value: string) {
    setPlots((prev) => prev.map((plot, i) => (i === index ? { ...plot, [field]: value } : plot)));
  }

  function addPlot() {
    setPlots((prev) => [...prev, { ...EMPTY_PLOT }]);
  }

  function removePlot(index: number) {
    setPlots((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await subdivideParcel({
      parcelId,
      surveyPlanId,
      plots: plots.map((plot) => ({
        plotNumber: plot.plotNumber,
        areaSqm: Number(plot.areaSqm),
        useType: plot.useType || undefined,
        notes: plot.notes || undefined,
      })),
    });

    setPending(false);
    if (result.ok) {
      setSurveyPlanId('');
      setPlots([{ ...EMPTY_PLOT }]);
    } else {
      setError(result.error ?? 'Failed to subdivide parcel.');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.space(4),
        marginBottom: tokens.space(6),
        padding: tokens.space(4),
        border: `1px solid ${tokens.color.border}`,
        borderRadius: tokens.radius.md,
      }}
    >
      <Select
        label="Approved survey plan"
        value={surveyPlanId}
        onChange={(e) => setSurveyPlanId(e.target.value)}
        options={surveyPlanOptions}
        placeholder={surveyPlanOptions.length === 0 ? 'No approved survey plans yet' : 'Select a survey plan…'}
        required
        style={{ minWidth: '220px' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space(3) }}>
        <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>Plots</span>
        {plots.map((plot, index) => (
          <div key={index} style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.space(3), alignItems: 'flex-end' }}>
            <TextField
              label={`Plot number (plot ${index + 1})`}
              value={plot.plotNumber}
              onChange={(e) => updatePlot(index, 'plotNumber', e.target.value)}
              required
              style={{ minWidth: '140px' }}
            />
            <TextField
              label={`Area sqm (plot ${index + 1})`}
              type="number"
              value={plot.areaSqm}
              onChange={(e) => updatePlot(index, 'areaSqm', e.target.value)}
              required
              style={{ minWidth: '120px' }}
            />
            <Select
              label={`Use type (plot ${index + 1})`}
              value={plot.useType}
              onChange={(e) => updatePlot(index, 'useType', e.target.value)}
              options={USE_TYPE_OPTIONS}
              placeholder="Default (Residential)"
              style={{ minWidth: '160px' }}
            />
            <TextField
              label={`Notes (plot ${index + 1})`}
              value={plot.notes}
              onChange={(e) => updatePlot(index, 'notes', e.target.value)}
              style={{ minWidth: '160px' }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => removePlot(index)}
              disabled={plots.length === 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={addPlot}
          style={{ alignSelf: 'flex-start' }}
        >
          + Add plot
        </Button>
      </div>

      <div style={{ display: 'flex', gap: tokens.space(3), alignItems: 'center' }}>
        <Button type="submit" disabled={pending}>
          {pending ? 'Subdividing…' : 'Subdivide parcel'}
        </Button>
        {error && <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, fontSize: '13px' }}>{error}</div>}
      </div>
    </form>
  );
}
