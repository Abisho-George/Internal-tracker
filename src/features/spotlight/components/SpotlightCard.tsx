import { useId, type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { Compass, Rocket, Star, type LucideIcon } from 'lucide-react';
import type { PastelKey } from '@/store/types';
import { Chip, TONE_SOFT_BG, TONE_TEXT, cn } from '@/components';
import type { Highlight } from '../spotlightStats';

export type SpotlightKind = 'person' | 'pm' | 'project';

export const SPOTLIGHT_KIND: Record<SpotlightKind, { label: string; tone: PastelKey; icon: LucideIcon; emoji: string }> = {
  person: { label: 'Spotlight Person', tone: 'mint', icon: Star, emoji: '🌟' },
  pm: { label: 'Spotlight PM', tone: 'sky', icon: Compass, emoji: '🧭' },
  project: { label: 'Spotlight Project', tone: 'peach', icon: Rocket, emoji: '🚀' },
};

/** Decorative glow per tone (full class strings so Tailwind keeps them). */
const GLOW: Record<PastelKey, string> = {
  mint: 'bg-mint-strong/25',
  sky: 'bg-sky-strong/25',
  peach: 'bg-peach-strong/25',
  lavender: 'bg-lavender-strong/25',
  butter: 'bg-butter-strong/25',
  coral: 'bg-coral-strong/25',
  grey: 'bg-grey-strong/25',
};

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 260, damping: 26 } },
};

const SPARKS = [
  { x: -54, y: -40, d: 0 },
  { x: 58, y: -34, d: 0.05 },
  { x: -64, y: 18, d: 0.1 },
  { x: 62, y: 26, d: 0.08 },
  { x: -12, y: -62, d: 0.12 },
  { x: 20, y: 58, d: 0.15 },
];

export interface SpotlightCardProps {
  kind: SpotlightKind;
  name: string;
  subtitle?: ReactNode;
  /** Avatar, or a project tile. */
  visual: ReactNode;
  citation: string;
  highlights: Highlight[];
  /** Month label shown on the card, e.g. "October 2026". */
  monthText: string;
  /** Plays the "just published" flourish. */
  celebrating?: boolean;
}

/** One large, pastel Spotlight card (Person = mint, PM = sky, Project = peach). */
export function SpotlightCard({ kind, name, subtitle, visual, citation, highlights, monthText, celebrating }: SpotlightCardProps) {
  const reduce = useReducedMotion();
  const meta = SPOTLIGHT_KIND[kind];
  const headingId = useId();
  const Icon = meta.icon;

  return (
    <motion.article
      variants={reduce ? undefined : cardVariants}
      aria-labelledby={headingId}
      data-testid={`spotlight-card-${kind}`}
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-card border border-line/60 p-6 shadow-soft',
        TONE_SOFT_BG[meta.tone],
      )}
    >
      <span aria-hidden className={cn('pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full blur-2xl', GLOW[meta.tone])} />

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-2 text-sm font-bold', TONE_TEXT[meta.tone])}>
          <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-surface/80 shadow-soft">
            <Icon className="h-4 w-4" />
          </span>
          {meta.label}
        </span>
        {celebrating ? (
          <Chip tone="lavender" size="sm" icon="✨">
            Just published
          </Chip>
        ) : (
          <span className="sr-only">{monthText}</span>
        )}
      </div>

      <div className="relative mt-6 flex flex-col items-center text-center">
        <div className="relative">
          <motion.div
            initial={reduce ? false : { scale: 0.6, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 16, delay: celebrating ? 0.25 : 0.1 }}
            className="rounded-full ring-4 ring-surface/80"
          >
            {visual}
          </motion.div>
          {celebrating &&
            !reduce &&
            SPARKS.map((s, i) => (
              <motion.span
                key={i}
                aria-hidden
                className={cn('pointer-events-none absolute left-1/2 top-1/2 text-sm', TONE_TEXT[meta.tone])}
                initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                animate={{ x: s.x, y: s.y, scale: [0, 1.4, 0.8], opacity: [0, 1, 0] }}
                transition={{ duration: 1.1, delay: 0.35 + s.d, ease: 'easeOut' }}
              >
                ✦
              </motion.span>
            ))}
        </div>
        <h3 id={headingId} className="mt-4 text-xl font-bold leading-tight text-ink">
          <span className="sr-only">{meta.label}: </span>
          {name}
        </h3>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>

      <blockquote className="relative mt-5 rounded-2xl bg-surface/80 px-4 py-3.5 text-sm leading-relaxed text-ink shadow-soft">
        <span aria-hidden className={cn('absolute -top-2 left-3 text-3xl font-bold leading-none', TONE_TEXT[meta.tone])}>
          “
        </span>
        <p className="pt-1">{citation}</p>
      </blockquote>

      <dl className="relative mt-auto grid grid-cols-3 gap-2 pt-5">
        {highlights.map((h) => (
          <div key={h.label} className="flex flex-col-reverse justify-end rounded-xl bg-surface/70 px-2 py-3 text-center">
            <dt className="mt-1 text-[11px] font-medium leading-tight text-muted">{h.label}</dt>
            <dd className="text-lg font-bold tabular-nums leading-none text-ink">{h.value}</dd>
          </div>
        ))}
      </dl>
    </motion.article>
  );
}
