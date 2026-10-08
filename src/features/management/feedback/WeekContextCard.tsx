import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowUpRight, NotebookPen, TrendingUp } from 'lucide-react';
import { addDaysISO, parseDate, personWeekStats } from '@/store';
import type { RatingMix } from '@/store';
import type { AppData, Person, Rating } from '@/store/types';
import { Card, RatingChip, SectionHeader, cn } from '@/components';

export interface WeekContextCardProps {
  data: AppData;
  person: Person;
  weekStart: string;
}

const MIX: { rating: Rating; key: keyof RatingMix }[] = [
  { rating: 'Better', key: 'better' },
  { rating: 'Optimal', key: 'optimal' },
  { rating: 'Can do better', key: 'canDoBetter' },
];

interface Row {
  label: string;
  hint?: string;
  now: string;
  before: string;
  /** True when this week reads better than the person's own last week. */
  up?: boolean;
}

/**
 * The person's own week vs their own last week, to help with writing.
 * Own history only — never another person's numbers.
 */
export function WeekContextCard({ data, person, weekStart }: WeekContextCardProps) {
  const { thisWeek, lastWeek } = useMemo(
    () => ({
      thisWeek: personWeekStats(data, person.id, weekStart),
      lastWeek: personWeekStats(data, person.id, addDaysISO(weekStart, -7)),
    }),
    [data, person.id, weekStart],
  );

  const pct = (n: number, has: boolean) => (has ? `${n}%` : '—');
  const hasNow = thisWeek.tasksDone > 0;
  const hasBefore = lastWeek.tasksDone > 0;
  const rows: Row[] = [
    {
      label: 'Tasks done',
      now: String(thisWeek.tasksDone),
      before: String(lastWeek.tasksDone),
    },
    {
      label: 'Time vs standard',
      hint: 'lower is quicker',
      now: pct(thisWeek.timeVsStandardPct, hasNow),
      before: pct(lastWeek.timeVsStandardPct, hasBefore),
      up: hasNow && hasBefore && thisWeek.timeVsStandardPct < lastWeek.timeVsStandardPct,
    },
    {
      label: 'Better ✦',
      now: String(thisWeek.mix.better),
      before: String(lastWeek.mix.better),
    },
    {
      label: 'Logged as you go',
      now: pct(thisWeek.disciplinePct, hasNow),
      before: pct(lastWeek.disciplinePct, hasBefore),
      up: hasNow && hasBefore && thisWeek.disciplinePct > lastWeek.disciplinePct,
    },
    {
      label: 'Daily notes',
      now: String(thisWeek.notes.length),
      before: String(lastWeek.notes.length),
    },
  ];

  return (
    <Card className="p-5" data-testid="week-context">
      <SectionHeader
        as="h2"
        icon={TrendingUp}
        tone="lavender"
        title={`${person.firstName}'s week so far`}
        description={`Compared only with ${person.firstName}'s own last week — a little help for writing.`}
      />

      <table className="w-full text-sm">
        <caption className="sr-only">{`${person.firstName}'s week compared with their own last week`}</caption>
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-faint">
            <th scope="col" className="pb-2 font-semibold">
              <span className="sr-only">Measure</span>
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              This week
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-semibold">
              Last week
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="py-2 pr-2 text-left font-medium text-muted">
                {r.label}
                {r.hint && <span className="block text-[11px] font-normal text-faint">{r.hint}</span>}
              </th>
              <td className="py-2 text-right font-bold tabular-nums text-ink">
                <span className={cn('inline-flex items-center gap-1', r.up && 'text-mint-ink')}>
                  {r.now}
                  {r.up && (
                    <span aria-label="(up on own last week)" className="text-xs">
                      ✦
                    </span>
                  )}
                </span>
              </td>
              <td className="py-2 pl-3 text-right tabular-nums text-muted">{r.before}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {hasNow && (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-ink">Rating mix this week</h3>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5">
            {MIX.map(({ rating, key }) => (
              <li key={rating} className="inline-flex items-center gap-1.5 text-sm font-semibold tabular-nums text-ink">
                <RatingChip rating={rating} size="sm" />
                {thisWeek.mix[key]}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
          <NotebookPen className="h-4 w-4 text-muted" aria-hidden />
          Daily notes this week
        </h3>
        {thisWeek.notes.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No notes this week — smooth sailing ⛵</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {thisWeek.notes.map((n) => (
              <li key={n.id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm leading-relaxed text-ink">
                <span className="mr-1.5 text-xs font-semibold text-muted">{format(parseDate(n.date), 'EEE')}</span>
                {n.text}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        to={`/insights?tab=person&id=${person.id}`}
        className="focus-ring mt-5 inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-accent-ink hover:underline"
      >
        See {person.firstName}'s trend in Insights
        <ArrowUpRight className="h-4 w-4" aria-hidden />
      </Link>
    </Card>
  );
}
