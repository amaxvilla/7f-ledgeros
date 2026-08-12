import * as React from 'react';
import { tokens } from '../tokens';

export interface PageContainerProps {
  children: React.ReactNode;
}

/**
 * Frontend Completion, Checkpoint F — shared page padding/width wrapper.
 *
 * Checkpoints A-E each duplicated the same
 * `<main style={{ padding: tokens.space(8), maxWidth: '1100px', margin:
 * '0 auto' }}>` inline-style block on every page (`/`, `/recruitment`,
 * `/payments`, `/security`), with a fixed 32px of padding regardless of
 * viewport width — explicitly flagged as untested at narrow viewports
 * in Checkpoint E's own release report. On a 375px-wide phone that's
 * 64px (~17%) of the screen lost to padding alone before any content
 * renders.
 *
 * `PageContainer` centralizes that wrapper (removing the four-way
 * duplication as a side effect) and adds a `@media` rule that tightens
 * padding below 640px — the same breakpoint `Nav` already uses for its
 * mobile collapse, reused here rather than inventing a second one.
 * Like `Nav`'s mobile panel, this needs a real `@media` query (inline
 * style objects can't express one), so it uses the same scoped
 * `<style>` + distinctive class-prefix approach (`x7fpage-` here,
 * mirroring `x7fnav-`) instead of a CSS module or a new build-time
 * dependency. Unlike `Nav`, no hook is used here, so this stays a
 * plain Server Component — `'use client'` is only required where a
 * component needs interactivity or a client-only API, not merely to
 * render a `<style>` tag.
 */
export function PageContainer({ children }: PageContainerProps) {
  return (
    <main className="x7fpage-main" style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <style>{`
        .x7fpage-main {
          padding: ${tokens.space(8)};
        }
        @media (max-width: 640px) {
          .x7fpage-main {
            padding: ${tokens.space(4)} ${tokens.space(3)};
          }
        }
      `}</style>
      {children}
    </main>
  );
}
