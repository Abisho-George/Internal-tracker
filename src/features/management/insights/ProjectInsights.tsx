import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight, Building2, CalendarHeart, Globe2, MessagesSquare, Timer } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Avatar, AvatarStack, Card, ChartTooltip, Chip, EmptyState, HealthRing, cn } from '@/components';
import {
  personById,
  projectById,
  projectHealth,
  projectWeeklySeries,
  sortPeople,
  weekStartOf,
  type AppData,
  type ProjectWeekPoint,
} from '@/store';
import { alpha, useChartColors, type ChartColors } from '@/theme/useChartColors';
import { CHART_MARGIN, ChartCard, ChartLegend, axisProps, gridProps, niceTicks } from './chartKit';
import type { RangeInfo } from './shared';

const LEVELS = [
  { key: 'l1', target: 'weeklyMessagesL1', title: 'L1 messages', name: 'First-level' },
  { key: 'l2', target: 'weeklyMessagesL2', title: 'L2 messages', name: 'Second-level' },
  { key: 'l3', target: 'weeklyMessagesL3', title: 'L3 messages', name: 'Third-level' },
] as const;

type Point = Omit<
  ProjectWeekPoint,
  'l1' | 'l2' | 'l3' | 'companies' | 'meetings' | 'meetingsCumulative' | 'timeVsStandardPct'
> & {
  l1: number | null;
  l2: number | null;
  l3: number | null;
  companies: number | null;
  meetings: number | null;
  meetingsCumulative: number | null;
  timeVsStandardPct: number | null;
  current: boolean;
};

export function ProjectInsights({ data, projectId, range }: { data: AppData; projectId: string; range: RangeInfo }) {
  const colors = useChartColors();
  const reduce = useReducedMotion();
  const project = projectById(data.projects, projectId);
  const series = useMemo(() => projectWeeklySeries(data, projectId, range.weeks), [data, projectId, range.weeks]);
  const health = useMemo(() => projectHealth(data, projectId), [data, projectId]);

  const points: Point[] = useMemo(() => {
    const startWeek = project ? weekStartOf(project.startDate) : '';
    const currentWeek = weekStartOf(data.demoDate);
    return series.map((p) => {
      const before = p.weekStart < startWeek;
      return {
        ...p,
        l1: before ? null : p.l1,
        l2: before ? null : p.l2,
        l3: before ? null : p.l3,
        companies: before ? null : p.companies,
        meetings: before ? null : p.meetings,
        meetingsCumulative: before ? null : p.meetingsCumulative,
        timeVsStandardPct: before || p.timeVsStandardPct <= 0 ? null : p.timeVsStandardPct,
        current: p.weekStart === currentWeek,
      };
    });
  }, [series, project, data.demoDate]);

  if (!project) return null;
  const pm = personById(data.people, project.pmId);
  const team = sortPeople(data.people.filter((p) => project.resourceIds.includes(p.id)));
  const hasWork = points.some(
    (p) => (p.l1 ?? 0) + (p.l2 ?? 0) + (p.l3 ?? 0) + (p.companies ?? 0) > 0 || (p.timeVsStandardPct ?? 0) > 0,
  );

  const timeValues = points.map((p) => p.timeVsStandardPct).filter((v): v is number => v != null);
  const projectAvg = timeValues.length ? Math.round(timeValues.reduce((s, v) => s + v, 0) / timeValues.length) : 0;
  const timeAxis = niceTicks(Math.max(0, Math.min(100, ...timeValues) - 5), Math.max(100, ...timeValues) + 5, 4);
  const companiesAxis = niceTicks(0, Math.max(project.targets.companies, ...points.map((p) => p.companies ?? 0)), 4, true);
  const meetingsAxis = niceTicks(
    0,
    Math.max(project.targets.meetingsTarget, ...points.map((p) => p.meetingsCumulative ?? 0)),
    4,
    true,
  );
  const last = points[points.length - 1];

  return (
    <div className="space-y-6">
      {/* Which project */}
      <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <HealthRing value={health} size={88} label="Health" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold leading-snug">{project.name}</h2>
            <Chip tone="grey" icon={Globe2} size="sm">
              {project.geography}
            </Chip>
            {project.status !== 'active' && (
              <Chip tone="butter" size="sm">
                {project.status === 'paused' ? 'Paused' : 'Wrapped up'}
              </Chip>
            )}
          </div>
          <p className="text-sm text-muted">Client: {project.client}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {pm && (
              <span className="inline-flex items-center gap-2 text-ink">
                <Avatar person={pm} size="xs" decorative />
                <span>
                  <span className="text-muted">PM </span>
                  {pm.name}
                </span>
              </span>
            )}
            {team.length > 0 && (
              <span className="inline-flex items-center gap-2">
                <AvatarStack people={team} size="xs" max={6} />
                <span className="text-muted">{team.length} on the team</span>
              </span>
            )}
          </div>
        </div>
        <Link
          to={`/projects/${project.id}`}
          className="focus-ring inline-flex items-center gap-1.5 self-start rounded-xl px-3 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-soft sm:self-center"
        >
          Open project <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </Card>

      {!hasWork ? (
        <Card>
          <EmptyState
            emoji="🌱"
            title="No logged work for this project yet"
            description="Weekly volumes, companies and meetings appear here once the team starts marking tasks done."
          />
        </Card>
      ) : (
        <>
          {/* L1 / L2 / L3 vs weekly targets — small multiples, one level each */}
          <section aria-labelledby="levels-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 id="levels-heading" className="flex items-center gap-2 text-base font-bold">
                  <MessagesSquare className="h-4 w-4 text-lavender-ink" aria-hidden /> Messages vs weekly targets
                </h3>
                <p className="text-sm text-muted">
                  Messages sent each week against the weekly target. The lighter bar is this week so far.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {LEVELS.map((lvl) => (
                <LevelChart
                  key={lvl.key}
                  colors={colors}
                  reduce={!!reduce}
                  title={lvl.title}
                  name={lvl.name}
                  target={project.targets[lvl.target]}
                  data={points.map((p) => ({ label: p.label, value: p[lvl.key], current: p.current }))}
                />
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Companies cumulative */}
            <ChartCard
              title="Companies researched"
              description={`Cumulative, against the engagement target of ${project.targets.companies}.`}
              icon={Building2}
              tone="mint"
              legend={
                <ChartLegend
                  items={[
                    { label: `Companies so far (${last.companies ?? 0})`, color: colors.mint, mark: 'line' },
                    { label: `Target (${project.targets.companies})`, color: colors.grey, mark: 'dashed' },
                  ]}
                />
              }
              summary={`Companies researched, cumulative: ${points
                .filter((p) => p.companies != null)
                .map((p) => `${p.label} ${p.companies}`)
                .join(', ')}. Target ${project.targets.companies}.`}
            >
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={points} margin={{ ...CHART_MARGIN, top: 16 }}>
                  <defs>
                    <linearGradient id={`co-${project.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.mint} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={colors.mint} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridProps(colors)} />
                  <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" />
                  <YAxis {...axisProps(colors)} width={40} domain={companiesAxis.domain} ticks={companiesAxis.ticks} />
                  <ReferenceLine y={project.targets.companies} stroke={colors.grey} strokeDasharray="6 4" strokeWidth={2} />
                  <Tooltip
                    cursor={{ stroke: colors.line, strokeWidth: 1.5 }}
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => `Up to week of ${String(l)}`}
                        valueFormatter={(v) => `${v} of ${project.targets.companies}`}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="companies"
                    name="Companies researched"
                    stroke={colors.mint}
                    strokeWidth={2.5}
                    fill={`url(#co-${project.id})`}
                    dot={{ r: 3.5, fill: colors.surface, stroke: colors.mint, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: colors.mint, stroke: colors.surface, strokeWidth: 2 }}
                    isAnimationActive={!reduce}
                    animationDuration={700}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Meetings */}
            <ChartCard
              title="Meetings booked"
              description={`Per week and cumulative, against the target of ${project.targets.meetingsTarget}.`}
              icon={CalendarHeart}
              tone="peach"
              legend={
                <ChartLegend
                  items={[
                    { label: 'Booked that week', color: colors.peach, mark: 'bar' },
                    { label: `Cumulative (${last.meetingsCumulative ?? 0})`, color: colors.lavender, mark: 'line' },
                    { label: `Target (${project.targets.meetingsTarget})`, color: colors.grey, mark: 'dashed' },
                  ]}
                />
              }
              summary={`Meetings booked per week: ${points
                .filter((p) => p.meetings != null)
                .map((p) => `${p.label} ${p.meetings}`)
                .join(', ')}. Cumulative ${last.meetingsCumulative ?? 0} of ${project.targets.meetingsTarget}.`}
            >
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={points} margin={{ ...CHART_MARGIN, top: 16 }}>
                  <CartesianGrid {...gridProps(colors)} />
                  <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" />
                  <YAxis {...axisProps(colors)} width={36} domain={meetingsAxis.domain} ticks={meetingsAxis.ticks} />
                  <ReferenceLine y={project.targets.meetingsTarget} stroke={colors.grey} strokeDasharray="6 4" strokeWidth={2} />
                  <Tooltip
                    cursor={{ fill: alpha(colors.line, 0.45) }}
                    content={<ChartTooltip labelFormatter={(l) => `Week of ${String(l)}`} />}
                  />
                  <Bar
                    dataKey="meetings"
                    name="Booked that week"
                    fill={colors.peach}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={!reduce}
                  />
                  <Line
                    type="monotone"
                    dataKey="meetingsCumulative"
                    name="Cumulative"
                    stroke={colors.lavender}
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: colors.surface, stroke: colors.lavender, strokeWidth: 2 }}
                    activeDot={{ r: 5, fill: colors.lavender, stroke: colors.surface, strokeWidth: 2 }}
                    isAnimationActive={!reduce}
                    animationDuration={700}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Time vs standard for the project */}
          <ChartCard
            title="Time vs standard for the project"
            description="All done tasks on this project, week by week. 100% is exactly on standard; lower is quicker."
            icon={Timer}
            tone="sky"
            legend={
              <ChartLegend
                items={[
                  { label: 'Time vs standard', color: colors.sky, mark: 'line' },
                  { label: `Project average (${projectAvg}%)`, color: colors.peach, mark: 'dashed' },
                  { label: 'Standard (100%)', color: colors.grey, mark: 'dotted' },
                ]}
              />
            }
            summary={`Project time vs standard: ${points
              .filter((p) => p.timeVsStandardPct != null)
              .map((p) => `${p.label} ${p.timeVsStandardPct}%`)
              .join(', ')}.`}
          >
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={points} margin={{ ...CHART_MARGIN, top: 16, right: 20 }}>
                <CartesianGrid {...gridProps(colors)} />
                <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" padding={{ left: 12, right: 12 }} />
                <YAxis
                  {...axisProps(colors)}
                  domain={timeAxis.domain}
                  ticks={timeAxis.ticks}
                  tickFormatter={(v: number) => `${v}%`}
                  width={48}
                />
                <ReferenceLine y={100} stroke={colors.grey} strokeDasharray="1.5 4" strokeWidth={2} />
                {projectAvg > 0 && <ReferenceLine y={projectAvg} stroke={colors.peach} strokeDasharray="6 4" strokeWidth={2} />}
                <Tooltip
                  cursor={{ stroke: colors.line, strokeWidth: 1.5 }}
                  content={
                    <ChartTooltip labelFormatter={(l) => `Week of ${String(l)}`} valueFormatter={(v) => `${v}% of standard`} />
                  }
                />
                <Line
                  type="monotone"
                  dataKey="timeVsStandardPct"
                  name="Time vs standard"
                  stroke={colors.sky}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: colors.surface, stroke: colors.sky, strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: colors.sky, stroke: colors.surface, strokeWidth: 2 }}
                  isAnimationActive={!reduce}
                  animationDuration={700}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}
    </div>
  );
}

interface LevelDatum {
  label: string;
  value: number | null;
  current: boolean;
}

function LevelChart({
  colors,
  reduce,
  title,
  name,
  target,
  data,
}: {
  colors: ChartColors;
  reduce: boolean;
  title: string;
  name: string;
  target: number;
  data: LevelDatum[];
}) {
  const full = data.filter((d) => !d.current && d.value != null) as { value: number }[];
  const avgFull = full.length ? Math.round(full.reduce((s, d) => s + d.value, 0) / full.length) : null;
  const current = data.find((d) => d.current);
  const share = avgFull != null && target > 0 ? Math.round((avgFull / target) * 100) : null;
  const axis = niceTicks(0, Math.max(target, ...data.map((d) => d.value ?? 0)) * 1.04, 3, true);

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-ink">{title}</h4>
          <p className="text-xs text-muted" title={`${name} messages`}>
            Target {target} a week
          </p>
        </div>
        {current?.value != null && (
          <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink">
            {current.value} this week
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid {...gridProps(colors)} />
          <XAxis dataKey="label" {...axisProps(colors)} tick={{ fill: colors.muted, fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis
            {...axisProps(colors)}
            tick={{ fill: colors.muted, fontSize: 11 }}
            width={36}
            domain={axis.domain}
            ticks={axis.ticks}
          />
          <ReferenceLine y={target} stroke={colors.grey} strokeDasharray="6 4" strokeWidth={2} />
          <Tooltip
            cursor={{ fill: alpha(colors.line, 0.45) }}
            content={<ChartTooltip labelFormatter={(l) => `Week of ${String(l)}`} valueFormatter={(v) => `${v} of ${target}`} />}
          />
          <Bar dataKey="value" name={`${title}`} radius={[4, 4, 0, 0]} isAnimationActive={!reduce}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.current ? alpha(colors.lavender, 0.45) : colors.lavender} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <ChartLegend
          items={[
            { label: 'Sent', color: colors.lavender, mark: 'bar' },
            { label: 'Weekly target', color: colors.grey, mark: 'dashed' },
          ]}
        />
        {share != null && (
          <span className={cn('text-xs font-semibold', share >= 100 ? 'text-mint-ink' : 'text-muted')}>
            Avg {avgFull}/week · {share}% of target
          </span>
        )}
      </div>
    </Card>
  );
}
