import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ClipboardCheck, FolderKanban, SlidersHorizontal, Target } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Avatar, Card, ChartTooltip, Chip, EmptyState, HealthRing, KpiTile } from '@/components';
import { formatMinutes, personById, pmStats, projectHealth, type AppData } from '@/store';
import { alpha, useChartColors } from '@/theme/useChartColors';
import { CHART_MARGIN, ChartCard, ChartLegend, axisProps, gridProps, niceTicks } from './chartKit';
import type { RangeInfo } from './shared';

export function PmInsights({ data, pmId, range }: { data: AppData; pmId: string; range: RangeInfo }) {
  const colors = useChartColors();
  const reduce = useReducedMotion();
  const pm = personById(data.people, pmId);
  const stats = useMemo(() => pmStats(data, pmId, range.weeks), [data, pmId, range.weeks]);
  const projects = useMemo(
    () =>
      [...stats.projects]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((p) => ({ project: p, health: projectHealth(data, p.id) })),
    [stats.projects, data],
  );

  const weekly = useMemo(
    () =>
      stats.weekly.map((w) => ({
        ...w,
        onTarget: w.onTargetPct,
        turnaround: w.reviewTurnaroundMinutes > 0 ? w.reviewTurnaroundMinutes : null,
      })),
    [stats.weekly],
  );

  const maxTurnaround = Math.max(30, ...weekly.map((w) => w.turnaround ?? 0));
  const turnStep = Math.max(30, Math.ceil(maxTurnaround / 4 / 30) * 30);
  const turnaroundAxis = {
    domain: [0, Math.ceil(maxTurnaround / turnStep) * turnStep] as [number, number],
    ticks: Array.from({ length: Math.ceil(maxTurnaround / turnStep) + 1 }, (_, i) => i * turnStep),
  };
  const adjustAxis = niceTicks(0, Math.max(3, ...weekly.map((w) => w.adjustments)), 3, true);

  if (!pm) return null;

  return (
    <div className="space-y-6">
      {/* Who + projects managed */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar person={pm} size="lg" decorative />
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-snug">{pm.name}</h2>
              <p className="text-sm text-muted">{pm.title}</p>
            </div>
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Projects managed</p>
            {projects.length === 0 ? (
              <p className="text-sm text-muted">No projects yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2" data-testid="pm-projects">
                {projects.map(({ project, health }) => (
                  <li key={project.id}>
                    <Link
                      to={`/insights?tab=project&id=${project.id}`}
                      className="focus-ring inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3.5 text-sm font-semibold text-ink transition hover:border-faint/50 hover:shadow-soft"
                      aria-label={`${project.name}, health ${Math.round(health * 100)}%. Open its trends`}
                    >
                      <HealthRing value={health} size={36} strokeWidth={4} />
                      <span className="max-w-[220px] truncate">{project.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Projects managed"
          value={projects.length}
          icon={FolderKanban}
          tone="sky"
          hint="Active and recent projects"
        />
        <KpiTile
          label="On target"
          value={`${stats.onTargetPct}%`}
          icon={Target}
          tone="mint"
          hint="Weekly L1/L2/L3 checks at 85%+ of target"
        />
        <KpiTile
          label="Average review turnaround"
          value={stats.avgReviewTurnaroundMinutes > 0 ? formatMinutes(stats.avgReviewTurnaroundMinutes) : '—'}
          icon={ClipboardCheck}
          tone="lavender"
          hint="From review request to decision"
        />
        <KpiTile
          label="Standard-time adjustments"
          value={stats.adjustmentsCount}
          icon={SlidersHorizontal}
          tone="peach"
          hint="Same-day adjustments made for the team"
        />
      </div>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🗂️"
            title={`${pm.firstName} has no projects in this range`}
            description="Weekly charts appear once a project is running."
          />
        </Card>
      ) : (
        <>
          <ChartCard
            title="On-target share, week by week"
            description={`Share of ${pm.firstName}'s weekly message targets (L1, L2, L3 per project) reached at 85% or more. This week is pro-rated.`}
            icon={Target}
            tone="mint"
            legend={<ChartLegend items={[{ label: 'On target', color: colors.mint, mark: 'line' }]} />}
            summary={weekly.map((w) => `${w.label} ${w.onTargetPct}%`).join(', ')}
          >
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weekly} margin={{ ...CHART_MARGIN, top: 16, right: 20 }}>
                <CartesianGrid {...gridProps(colors)} />
                <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" padding={{ left: 12, right: 12 }} />
                <YAxis
                  {...axisProps(colors)}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  width={48}
                />
                <Tooltip
                  cursor={{ stroke: colors.line, strokeWidth: 1.5 }}
                  content={<ChartTooltip labelFormatter={(l) => `Week of ${String(l)}`} valueFormatter={(v) => `${v}%`} />}
                />
                <Line
                  type="monotone"
                  dataKey="onTarget"
                  name="On target"
                  stroke={colors.mint}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: colors.surface, stroke: colors.mint, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: colors.mint, stroke: colors.surface, strokeWidth: 2 }}
                  isAnimationActive={!reduce}
                  animationDuration={700}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard
              title="Review turnaround"
              description="Average time from a review request to approve or send back, per week."
              icon={ClipboardCheck}
              tone="lavender"
              legend={<ChartLegend items={[{ label: 'Average turnaround', color: colors.lavender, mark: 'line' }]} />}
              summary={weekly.map((w) => `${w.label} ${w.turnaround ? formatMinutes(w.turnaround) : 'no reviews'}`).join(', ')}
            >
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weekly} margin={{ ...CHART_MARGIN, top: 16, right: 20 }}>
                  <CartesianGrid {...gridProps(colors)} />
                  <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" padding={{ left: 12, right: 12 }} />
                  <YAxis
                    {...axisProps(colors)}
                    width={56}
                    domain={turnaroundAxis.domain}
                    ticks={turnaroundAxis.ticks}
                    tickFormatter={(v: number) => formatMinutes(v)}
                  />
                  <Tooltip
                    cursor={{ stroke: colors.line, strokeWidth: 1.5 }}
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => `Week of ${String(l)}`}
                        valueFormatter={(v) => formatMinutes(Number(v))}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="turnaround"
                    name="Average turnaround"
                    stroke={colors.lavender}
                    strokeWidth={2.5}
                    connectNulls
                    dot={{ r: 3.5, fill: colors.surface, stroke: colors.lavender, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: colors.lavender, stroke: colors.surface, strokeWidth: 2 }}
                    isAnimationActive={!reduce}
                    animationDuration={700}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Standard-time adjustments"
              description="Same-day adjustments (tool outages, rework, training…) per week."
              icon={SlidersHorizontal}
              tone="peach"
              legend={<ChartLegend items={[{ label: 'Adjustments', color: colors.peach, mark: 'bar' }]} />}
              summary={weekly.map((w) => `${w.label} ${w.adjustments}`).join(', ')}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weekly} margin={{ ...CHART_MARGIN, top: 16 }}>
                  <CartesianGrid {...gridProps(colors)} />
                  <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" />
                  <YAxis {...axisProps(colors)} width={36} domain={adjustAxis.domain} ticks={adjustAxis.ticks} />
                  <Tooltip
                    cursor={{ fill: alpha(colors.line, 0.45) }}
                    content={<ChartTooltip labelFormatter={(l) => `Week of ${String(l)}`} />}
                  />
                  <Bar
                    dataKey="adjustments"
                    name="Adjustments"
                    fill={colors.peach}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={!reduce}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted">
            <Chip tone="lavender" size="sm">
              One PM at a time
            </Chip>
            {pm.firstName}&apos;s numbers are shown on their own — never side by side with anyone else.
          </p>
        </>
      )}
    </div>
  );
}
