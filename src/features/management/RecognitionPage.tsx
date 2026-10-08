import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Info, LineChart as LineChartIcon, Lock, NotebookPen } from 'lucide-react';
import { Avatar, Card, Chip, Page, ProgressBar, SegmentedControl, TONE_SOFT, cn } from '@/components';
import { addDaysISO, parseDate, recognitionRows, weekStartOf } from '@/store';
import { baselineWording, useAppData } from './insights/shared';

type Period = 'weekly' | 'monthly';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/**
 * Recognition & incentives (spec §8.3 E), management only. Alphabetical, no rank
 * numbers, no sorting by score: each person is compared only with their own baseline.
 */
export default function RecognitionPage() {
  const data = useAppData();
  const [period, setPeriod] = useState<Period>('monthly');
  const rows = useMemo(() => recognitionRows(data, period), [data, period]);

  const windows = useMemo(() => {
    const currentWeek = weekStartOf(data.demoDate);
    const d = (iso: string) => format(parseDate(iso), 'd MMM');
    if (period === 'weekly') {
      return {
        current: `this week so far (${d(currentWeek)} – ${d(data.demoDate)})`,
        baseline: `their previous 4 weeks (${d(addDaysISO(currentWeek, -28))} – ${d(addDaysISO(currentWeek, -3))})`,
      };
    }
    const from = addDaysISO(currentWeek, -21);
    return {
      current: `the last 4 weeks (${d(from)} – ${d(data.demoDate)})`,
      baseline: `the 4 weeks before (${d(addDaysISO(from, -28))} – ${d(addDaysISO(from, -3))})`,
    };
  }, [data.demoDate, period]);

  return (
    <Page
      title="Recognition & incentives"
      subtitle="A gentle, data-informed starting point for incentives. You always make the final call."
    >
      <div
        role="note"
        className="mb-6 flex items-start gap-3 rounded-card border border-peach-strong/40 bg-peach-soft px-4 py-3.5 text-peach-ink sm:items-center"
        data-testid="mgmt-only-banner"
      >
        <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface/70">
          <Lock className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="font-bold">Visible to management only</p>
          <p className="text-sm">Resources and PMs never see this page or these suggestions.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl ariaLabel="Period" options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        <p className="text-sm text-muted" aria-live="polite" data-testid="period-hint">
          Comparing {windows.current} with {windows.baseline}.
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm" data-testid="recognition-table">
            <caption className="sr-only">
              People in alphabetical order, each compared only with their own baseline ({period}).
            </caption>
            <thead>
              <tr className="border-b border-line/70 bg-surface-2/60 text-xs font-semibold uppercase tracking-wide text-muted">
                <th scope="col" className="px-5 py-3 sm:px-6">
                  Person
                </th>
                <th scope="col" className="px-3 py-3">
                  Performance vs own baseline
                </th>
                <th scope="col" className="px-3 py-3">
                  Discipline score
                </th>
                <th scope="col" className="px-3 py-3">
                  Notes written
                </th>
                <th scope="col" className="px-3 py-3">
                  Suggested tier
                </th>
                <th scope="col" className="px-5 py-3 sm:px-6">
                  <span className="sr-only">Trend</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const perf = baselineWording(row.performanceChangePct);
                const eligible = row.tier === 'Eligible';
                return (
                  <tr key={row.person.id} className="border-b border-line/50 last:border-0" data-person={row.person.name}>
                    <th scope="row" className="px-5 py-3.5 sm:px-6">
                      <span className="flex items-center gap-3">
                        <Avatar person={row.person} size="sm" decorative />
                        <span className="min-w-0">
                          <span className="block font-semibold text-ink">{row.person.name}</span>
                          <span className="block text-xs font-normal text-muted">{row.person.title}</span>
                        </span>
                      </span>
                    </th>
                    <td className="px-3 py-3.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
                          TONE_SOFT[perf.tone],
                        )}
                        title={perf.text}
                      >
                        <span aria-hidden>{perf.glyph}</span> {perf.short}
                        <span className="sr-only"> {perf.text.replace(perf.short ?? '', '').trim()}</span>
                      </span>
                      {row.currentPct > 0 && row.baselinePct > 0 && (
                        <span className="mt-1 block text-xs text-muted">
                          {row.currentPct}% of standard time, own baseline {row.baselinePct}%
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="flex w-36 items-center gap-2">
                        <ProgressBar
                          value={row.disciplinePct}
                          max={100}
                          tone="mint"
                          size="sm"
                          ariaLabel={`${row.person.firstName}'s discipline score`}
                          valueText={`${row.disciplinePct}%`}
                          className="flex-1"
                        />
                        <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-ink">{row.disciplinePct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1.5 font-semibold tabular-nums text-ink">
                        <NotebookPen className="h-3.5 w-3.5 text-lavender-ink" aria-hidden />
                        {row.notesWritten}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {eligible ? (
                        <Chip tone="mint" icon={<span>✦</span>}>
                          Eligible
                        </Chip>
                      ) : (
                        <Chip tone="grey">Not this month</Chip>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right sm:px-6">
                      <Link
                        to={`/insights?tab=person&id=${row.person.id}`}
                        className="focus-ring inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-soft"
                        aria-label={`See ${row.person.firstName}'s trend`}
                      >
                        <LineChartIcon className="h-3.5 w-3.5" aria-hidden /> Trend
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 p-5 sm:p-6" data-testid="tier-explainer">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <Info className="h-4 w-4 text-sky-ink" aria-hidden /> How the tier is suggested
        </h2>
        <ul className="space-y-2 text-sm leading-relaxed text-muted">
          <li>
            <span className="font-semibold text-ink">Eligible ✦</span> when someone is at or quicker than their own baseline (with
            3% of wiggle room for normal ups and downs) <span className="font-semibold text-ink">and</span> logged at least 80% of
            their tasks as they went.
          </li>
          <li>
            <span className="font-semibold text-ink">Not this month</span> otherwise. It is a quiet suggestion, never a judgement,
            and it never reaches the person.
          </li>
          <li>
            Performance is time vs standard compared with the person&apos;s <em>own</em> history only. People are listed
            alphabetically, with no numbering and no ordering by score.
          </li>
        </ul>
      </Card>
    </Page>
  );
}
