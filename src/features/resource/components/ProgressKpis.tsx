import type { ReactNode } from 'react';
import { CheckCheck, Footprints, Gauge, Sparkles } from 'lucide-react';
import { RATING_ORDER } from '@/store';
import type { RatingMix, WeekStats } from '@/store';
import type { PastelKey, Rating } from '@/store/types';
import { KpiTile, RATING_STYLE, TONE_STRONG_BG, TONE_TEXT, cn } from '@/components';

const MIX_KEY: Record<Rating, keyof RatingMix> = {
  Better: 'better',
  Optimal: 'optimal',
  'Can do better': 'canDoBetter',
};

function mixTotal(mix: RatingMix): number {
  return mix.better + mix.optimal + mix.canDoBetter;
}

/** Share of rated tasks that were Better or Optimal (0..100). */
function happyShare(mix: RatingMix): number {
  const total = mixTotal(mix);
  return total ? Math.round(((mix.better + mix.optimal) / total) * 100) : 0;
}

/** Mini stacked bar + counts with icons. */
function MixBreakdown({ mix }: { mix: RatingMix }) {
  const total = mixTotal(mix);
  return (
    <div className="space-y-2.5">
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {total > 0 &&
          RATING_ORDER.map((r) => {
            const n = mix[MIX_KEY[r]];
            if (!n) return null;
            return (
              <span
                key={r}
                className={cn('h-full first:rounded-l-full last:rounded-r-full', TONE_STRONG_BG[RATING_STYLE[r].tone])}
                style={{ width: `${(n / total) * 100}%` }}
              />
            );
          })}
      </div>
      <ul className="space-y-1">
        {RATING_ORDER.map((r) => (
          <li key={r} className="flex items-center justify-between gap-2 text-xs">
            <span className={cn('inline-flex items-center gap-1.5 font-semibold', TONE_TEXT[RATING_STYLE[r].tone])}>
              {RATING_STYLE[r].glyph('sm')}
              <span className="text-ink">{r}</span>
            </span>
            <span className="font-semibold tabular-nums text-ink">{mix[MIX_KEY[r]]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hints reserve two lines on the 4-up grid so the delta pills line up across tiles. */
function Hint({ children }: { children: ReactNode }) {
  return <span className="block xl:min-h-8">{children}</span>;
}

/** Footer pinned to the tile bottom: an optional 8-week sparkline + the own last-week number. */
function TileFooter({
  label = 'Last week',
  value,
  spark,
  tone,
}: {
  label?: string;
  value: ReactNode;
  /** Oldest → newest; the last value is this week. */
  spark?: number[];
  tone?: PastelKey;
}) {
  return (
    <div className="mt-auto space-y-3">
      {spark && tone && <Sparkline values={spark} tone={tone} />}
      <div className="flex items-center justify-between gap-2 border-t border-line/70 pt-3 text-xs" data-testid="kpi-last-week">
        <span className="text-muted">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{value}</span>
      </div>
    </div>
  );
}

/** Tiny decorative 8-week bar sparkline (the charts below carry the accessible data). */
function Sparkline({ values, tone }: { values: number[]; tone: PastelKey }) {
  const active = values.filter((v) => v > 0);
  const lo = active.length ? Math.min(...active) : 0;
  const hi = active.length ? Math.max(...active) : 1;
  const height = (v: number) => (v <= 0 ? 6 : hi === lo ? 70 : 25 + ((v - lo) / (hi - lo)) * 75);
  return (
    <div aria-hidden data-testid="kpi-sparkline">
      <div className="flex h-9 items-end gap-1">
        {values.map((v, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-sm', TONE_STRONG_BG[tone], i === values.length - 1 ? 'opacity-100' : 'opacity-35')}
            style={{ height: `${height(v)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-faint">
        <span>8 weeks ago</span>
        <span>This week</span>
      </div>
    </div>
  );
}

export interface ProgressKpisProps {
  thisWeek: WeekStats;
  lastWeek: WeekStats;
  /** Last week up to the same weekday, so a part-week is compared fairly. */
  lastWeekToDate: WeekStats;
  /** Short weekday of the demo date, e.g. "Thu" (for "Last week by Thu"). */
  weekdayLabel?: string;
  /** The person's own last 8 weeks, oldest → newest (for the sparklines). */
  series?: WeekStats[];
}

/** This week vs the person's OWN last week. */
export function ProgressKpis({ thisWeek, lastWeek, lastWeekToDate, weekdayLabel, series }: ProgressKpisProps) {
  const hasThis = thisWeek.tasksDone > 0;
  const spark = (pick: (w: WeekStats) => number) => series?.map((w) => (w.tasksDone > 0 ? pick(w) : 0));
  const hasLast = lastWeek.tasksDone > 0;

  const tasksDelta =
    lastWeekToDate.tasksDone > 0
      ? {
          pct: ((thisWeek.tasksDone - lastWeekToDate.tasksDone) / lastWeekToDate.tasksDone) * 100,
          goodWhen: 'up' as const,
          caption: 'vs last week so far',
        }
      : undefined;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="progress-kpis">
      <KpiTile
        label="Tasks done"
        value={thisWeek.tasksDone}
        icon={CheckCheck}
        tone="mint"
        hint={<Hint>This week so far</Hint>}
        delta={tasksDelta}
      >
        <TileFooter
          label={weekdayLabel ? `Last week by ${weekdayLabel}` : 'Last week so far'}
          value={lastWeekToDate.tasksDone}
          spark={spark((w) => w.tasksDone)}
          tone="mint"
        />
      </KpiTile>
      <KpiTile
        label="Time vs standard"
        value={hasThis ? `${thisWeek.timeVsStandardPct}%` : '—'}
        icon={Gauge}
        tone="lavender"
        hint={<Hint>{hasThis ? 'of standard time · lower is quicker' : 'Shows up once you log a task this week'}</Hint>}
        delta={
          hasThis && hasLast
            ? { pct: thisWeek.timeVsStandardPct - lastWeek.timeVsStandardPct, goodWhen: 'down' }
            : undefined
        }
      >
        <TileFooter
          value={hasLast ? `${lastWeek.timeVsStandardPct}%` : '—'}
          spark={spark((w) => w.timeVsStandardPct)}
          tone="lavender"
        />
      </KpiTile>
      <KpiTile
        label="Rating mix"
        value={hasThis ? `${happyShare(thisWeek.mix)}%` : '—'}
        icon={Sparkles}
        tone="sky"
        hint={<Hint>Better or Optimal this week</Hint>}
        delta={
          hasThis && hasLast ? { pct: happyShare(thisWeek.mix) - happyShare(lastWeek.mix), goodWhen: 'up' } : undefined
        }
      >
        <MixBreakdown mix={thisWeek.mix} />
        <TileFooter value={hasLast ? `${happyShare(lastWeek.mix)}%` : '—'} />
      </KpiTile>
      <KpiTile
        label="Discipline score"
        value={hasThis ? `${thisWeek.disciplinePct}%` : '—'}
        icon={Footprints}
        tone="peach"
        hint={<Hint>Tasks logged as you go</Hint>}
        delta={hasThis && hasLast ? { pct: thisWeek.disciplinePct - lastWeek.disciplinePct, goodWhen: 'up' } : undefined}
      >
        <TileFooter
          value={hasLast ? `${lastWeek.disciplinePct}%` : '—'}
          spark={spark((w) => w.disciplinePct)}
          tone="peach"
        />
      </KpiTile>
    </div>
  );
}
