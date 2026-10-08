import { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import { CalendarCheck, ClipboardList, Gauge, History, NotebookPen, Sparkles, Timer } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Avatar, Card, ChartTooltip, Chip, EmptyState, KpiTile, ProjectChip, RatingChip, TONE_SOFT, cn } from '@/components';
import { personAverage, personById, personWeeklySeries, projectsForPerson, weekStartOf, type AppData } from '@/store';
import { alpha, useChartColors } from '@/theme/useChartColors';
import { CHART_MARGIN, ChartCard, ChartLegend, axisProps, gridProps, niceTicks } from './chartKit';
import { PersonTrendChart, type TrendPoint } from './PersonTrendChart';
import { pctText, shortDay, weekOf, weekOverWeek, type RangeInfo } from './shared';

export function PersonInsights({ data, personId, range }: { data: AppData; personId: string; range: RangeInfo }) {
  const colors = useChartColors();
  const reduce = useReducedMotion();
  const person = personById(data.people, personId);
  const series = useMemo(() => personWeeklySeries(data, personId, range.weeks), [data, personId, range.weeks]);
  const projects = useMemo(() => projectsForPerson(data, personId), [data, personId]);

  const view = useMemo(() => {
    const activeWeeks = series.filter((w) => w.tasksDone > 0);
    const average = personAverage(series);
    const disciplineAvg = activeWeeks.length
      ? Math.round(activeWeeks.reduce((s, w) => s + w.disciplinePct, 0) / activeWeeks.length)
      : 0;
    const points: TrendPoint[] = series.map((w) => ({
      weekStart: w.weekStart,
      label: w.label,
      pct: w.tasksDone > 0 ? w.timeVsStandardPct : null,
      notes: w.notes,
    }));
    const mix = series.map((w) => ({ label: w.label, ...w.mix }));
    const mixAxis = niceTicks(0, Math.max(1, ...mix.map((m) => m.better + m.optimal + m.canDoBetter)), 4, true);
    const discipline = series.map((w) => ({ label: w.label, discipline: w.tasksDone > 0 ? w.disciplinePct : null }));
    const notes = series.flatMap((w) => w.notes);
    const tasksTotal = series.reduce((s, w) => s + w.tasksDone, 0);
    return { activeWeeks, average, disciplineAvg, points, mix, mixAxis, discipline, notes, tasksTotal };
  }, [series]);

  if (!person) return null;
  const current = series[series.length - 1];
  const currentWeek = weekStartOf(data.demoDate);

  if (view.activeWeeks.length === 0) {
    return (
      <Card>
        <EmptyState
          emoji="🌱"
          title={`Nothing logged for ${person.firstName} in this range yet`}
          description="Trends appear once a few tasks are marked done."
        />
      </Card>
    );
  }

  const thisWeekDelta =
    current.tasksDone > 0 && view.average > 0
      ? {
          pct: ((current.timeVsStandardPct - view.average) / view.average) * 100,
          goodWhen: 'down' as const,
          caption: 'vs own average',
        }
      : undefined;

  return (
    <div className="space-y-6">
      {/* Who */}
      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar person={person} size="lg" decorative />
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-snug">{person.name}</h2>
            <p className="text-sm text-muted">{person.title}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {projects.map((p) => (
                <ProjectChip key={p.id} project={p} />
              ))}
            </div>
          </div>
        </div>
        <Chip tone="lavender" icon={History} className="self-start sm:self-center">
          Compared only with {person.firstName}&apos;s own history
        </Chip>
      </Card>

      {/* Headline numbers */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Own average"
          value={pctText(view.average)}
          icon={Gauge}
          tone="peach"
          hint="Time vs standard across these weeks · lower is quicker"
        />
        <KpiTile
          label="This week so far"
          value={pctText(current.tasksDone > 0 ? current.timeVsStandardPct : null)}
          icon={Timer}
          tone="sky"
          delta={thisWeekDelta}
          hint="Time vs standard"
        />
        <KpiTile
          label="Tasks done"
          value={view.tasksTotal}
          icon={ClipboardList}
          tone="mint"
          hint={`${current.tasksDone} so far this week`}
        />
        <KpiTile
          label="Logged as you go"
          value={`${view.disciplineAvg}%`}
          icon={CalendarCheck}
          tone="lavender"
          hint="Average discipline score"
        />
      </div>

      {/* Trend vs own average, with daily-note markers */}
      <ChartCard
        title="Time vs standard, week by week"
        description={`100% means exactly on standard time; lower is quicker. ${person.firstName} is only compared with their own average.`}
        icon={Sparkles}
        tone="sky"
        summary={`${person.firstName}'s weekly time vs standard: ${view.points
          .filter((p) => p.pct != null)
          .map((p) => `${p.label} ${p.pct}%`)
          .join(', ')}. Own average ${view.average}%.`}
      >
        <PersonTrendChart points={view.points} average={view.average} firstName={person.firstName} />

        <div className="mt-5 border-t border-line/70 pt-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
            <NotebookPen className="h-4 w-4 text-lavender-ink" aria-hidden />
            {person.firstName}&apos;s daily notes in this range
          </h4>
          {view.notes.length === 0 ? (
            <p className="text-sm text-muted">No daily notes in these weeks.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2" data-testid="person-notes">
              {view.notes.map((n) => (
                <li key={n.id} className="flex gap-3 rounded-xl bg-lavender-soft/60 px-3 py-2.5 text-sm">
                  <span aria-hidden className="mt-0.5">
                    📝
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-lavender-ink">{shortDay(n.date)}</p>
                    <p className="leading-snug text-ink">{n.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Rating mix */}
        <ChartCard
          title="Rating mix over time"
          description="Tasks per week by rating."
          legend={
            <div className="flex flex-wrap gap-2">
              <RatingChip rating="Better" size="sm" />
              <RatingChip rating="Optimal" size="sm" />
              <RatingChip rating="Can do better" size="sm" />
            </div>
          }
          summary={view.mix
            .map((m) => `${m.label}: ${m.better} Better, ${m.optimal} Optimal, ${m.canDoBetter} Can do better`)
            .join('. ')}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={view.mix} margin={CHART_MARGIN} barCategoryGap="28%">
              <CartesianGrid {...gridProps(colors)} />
              <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" />
              <YAxis
                {...axisProps(colors)}
                allowDecimals={false}
                width={36}
                domain={view.mixAxis.domain}
                ticks={view.mixAxis.ticks}
              />
              <Tooltip
                cursor={{ fill: alpha(colors.line, 0.45) }}
                content={<ChartTooltip labelFormatter={(l) => `Week of ${String(l)}`} valueFormatter={(v) => `${v} tasks`} />}
              />
              <Bar
                dataKey="better"
                name="Better ✦"
                stackId="mix"
                fill={colors.mint}
                stroke={colors.surface}
                strokeWidth={1.5}
                isAnimationActive={!reduce}
              />
              <Bar
                dataKey="optimal"
                name="Optimal ✓"
                stackId="mix"
                fill={colors.sky}
                stroke={colors.surface}
                strokeWidth={1.5}
                isAnimationActive={!reduce}
              />
              <Bar
                dataKey="canDoBetter"
                name="Can do better ↗"
                stackId="mix"
                fill={colors.butter}
                stroke={colors.surface}
                strokeWidth={1.5}
                radius={[4, 4, 0, 0]}
                isAnimationActive={!reduce}
                animationDuration={700}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Discipline */}
        <ChartCard
          title="Discipline trend"
          description="Share of tasks logged as they were finished (not in an end-of-day batch)."
          legend={
            <ChartLegend
              items={[
                { label: 'Logged as you go', color: colors.mint, mark: 'line' },
                { label: `Own average (${view.disciplineAvg}%)`, color: colors.peach, mark: 'dashed' },
              ]}
            />
          }
          summary={view.discipline
            .filter((d) => d.discipline != null)
            .map((d) => `${d.label} ${d.discipline}%`)
            .join(', ')}
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={view.discipline} margin={{ ...CHART_MARGIN, top: 16 }}>
              <defs>
                <linearGradient id={`disc-${personId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.mint} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colors.mint} stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps(colors)} />
              <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" />
              <YAxis
                {...axisProps(colors)}
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v: number) => `${v}%`}
                width={48}
              />
              <ReferenceLine y={view.disciplineAvg} stroke={colors.peach} strokeDasharray="6 4" strokeWidth={2} />
              <Tooltip
                cursor={{ stroke: colors.line, strokeWidth: 1.5 }}
                content={<ChartTooltip labelFormatter={(l) => `Week of ${String(l)}`} valueFormatter={(v) => `${v}%`} />}
              />
              <Area
                type="monotone"
                dataKey="discipline"
                name="Logged as you go"
                stroke={colors.mint}
                strokeWidth={2.5}
                fill={`url(#disc-${personId})`}
                connectNulls={false}
                dot={{ r: 3.5, fill: colors.surface, stroke: colors.mint, strokeWidth: 2 }}
                activeDot={{ r: 5, fill: colors.mint, stroke: colors.surface, strokeWidth: 2 }}
                isAnimationActive={!reduce}
                animationDuration={700}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Week over week */}
      <Card className="p-0">
        <div className="px-5 pb-3 pt-5 sm:px-6">
          <h3 className="text-base font-bold">Week over week</h3>
          <p className="mt-0.5 text-sm text-muted">Each week compared with {person.firstName}&apos;s own previous week.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="wow-table">
            <caption className="sr-only">{person.firstName}&apos;s week-over-week changes, oldest week first</caption>
            <thead>
              <tr className="border-y border-line/70 bg-surface-2/60 text-xs font-semibold uppercase tracking-wide text-muted">
                <th scope="col" className="px-5 py-2.5 sm:px-6">
                  Week
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Time vs standard
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Change vs previous week
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Tasks done
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Rating mix
                </th>
                <th scope="col" className="px-5 py-2.5 sm:px-6">
                  Discipline
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map((w, i) => {
                const prev = i > 0 && series[i - 1].tasksDone > 0 ? series[i - 1].timeVsStandardPct : null;
                const delta = weekOverWeek(prev, w.tasksDone > 0 ? w.timeVsStandardPct : null);
                const isCurrent = w.weekStart === currentWeek;
                return (
                  <tr key={w.weekStart} className="border-b border-line/50 last:border-0">
                    <th scope="row" className="whitespace-nowrap px-5 py-3 font-semibold text-ink sm:px-6">
                      {weekOf(w.weekStart)}
                      {isCurrent && <span className="ml-1.5 text-xs font-medium text-muted">(so far)</span>}
                      {w.notes.length > 0 && (
                        <span
                          className="ml-1.5"
                          role="img"
                          aria-label={`${w.notes.length} daily ${w.notes.length === 1 ? 'note' : 'notes'}`}
                        >
                          📝
                        </span>
                      )}
                    </th>
                    <td className="px-3 py-3 tabular-nums text-ink">{pctText(w.tasksDone > 0 ? w.timeVsStandardPct : null)}</td>
                    <td className="px-3 py-3">
                      {delta ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
                            TONE_SOFT[delta.tone],
                          )}
                        >
                          <span aria-hidden>{delta.glyph}</span> {delta.text}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">{i === 0 ? 'First week shown' : '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-ink">{w.tasksDone}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold">
                      <span className="text-mint-ink">
                        <span aria-hidden>✦</span> {w.mix.better}
                        <span className="sr-only"> Better</span>
                      </span>
                      <span className="mx-1.5 text-faint" aria-hidden>
                        ·
                      </span>
                      <span className="text-sky-ink">
                        <span aria-hidden>✓</span> {w.mix.optimal}
                        <span className="sr-only"> Optimal</span>
                      </span>
                      <span className="mx-1.5 text-faint" aria-hidden>
                        ·
                      </span>
                      <span className="text-butter-ink">
                        <span aria-hidden>↗</span> {w.mix.canDoBetter}
                        <span className="sr-only"> Can do better</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums text-ink sm:px-6">{w.tasksDone > 0 ? `${w.disciplinePct}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
