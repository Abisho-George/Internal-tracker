// Analytics charts: KPI trend line, sparkline, "Where time goes" bars and the assignment difficulty mix.
import { useMemo } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { ChartTooltip } from '@/components';
import { useChartColors, type ChartColors } from '@/theme/useChartColors';
import {
  assignmentMixByAssigner, DIFFICULTY_BAND, fmtKpi, KPI_LABEL, timeSplit, type Kpi, type SeriesPoint, type TimeSlice,
} from '../../analytics';
import { nameOf, useStore } from '../../store';
import { Avatar, PROJECT_COLORS, cx, fmtMin } from '../../ui';
import { useSlice } from './controls';

/** Project colours stepped for a dark surface (same hues as PROJECT_COLORS, validated for the dark band). */
const PROJECT_COLORS_DARK = ['#4F7BE8', '#E0524F', '#1E9E6E', '#8B6BE0', '#B47D0C', '#1594B4'];
const luminance = (rgb: string) => {
  const [r, g, b] = (rgb.match(/[\d.]+/g) ?? ['255', '255', '255']).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
export const isDarkSurface = (colors: ChartColors) => luminance(colors.surface) < 0.4;

/** Colour per project (follows the project everywhere), grey for time not linked to a project. */
export function useProjectColor(): (id: string) => string {
  const colors = useChartColors();
  const projects = useStore((s) => s.projects);
  return useMemo(() => {
    const pal = isDarkSurface(colors) ? PROJECT_COLORS_DARK : PROJECT_COLORS;
    return (id: string) => {
      const i = projects.findIndex((p) => p.id === id);
      return i < 0 ? colors.grey : pal[i % pal.length];
    };
  }, [colors, projects]);
}

const yTick = (kpi: Kpi) => (v: number) => (kpi === 'onTime' ? `${v}%` : kpi === 'hours' || kpi === 'extra' ? `${v}h` : String(v));

interface DotProps { cx?: number; cy?: number; index?: number; payload?: { key: string; v: number | null; partial: boolean } }

/**
 * The line graph (same look as before: accent line, dots, light grid, 80% goal on on-time),
 * now for any KPI and granularity. The selected period is ringed; a hollow dot means the period is still running.
 */
export function KpiTrend({ points, kpi, selectedKey, height = 224 }: { points: SeriesPoint[]; kpi: Kpi; selectedKey?: string; height?: number }) {
  const colors = useChartColors();
  const data = points.map((p) => ({ key: p.key, label: p.label, title: p.title, partial: p.partial, v: p.value }));
  const byKey = new Map(data.map((d) => [d.key, d]));
  const hasData = data.some((d) => d.v != null && (kpi === 'onTime' || d.v > 0));
  const renderDot = (props: DotProps) => {
    const { cx: x, cy: y, index, payload } = props;
    if (x == null || y == null || !payload || payload.v == null) return <g key={`d${index}`} />;
    const sel = payload.key === selectedKey;
    return (
      <g key={`d${index}`}>
        {sel && <circle cx={x} cy={y} r={9} fill="none" stroke={colors.accent} strokeOpacity={0.45} strokeWidth={2} />}
        <circle cx={x} cy={y} r={sel ? 5 : 4} fill={payload.partial ? colors.surface : colors.accent} stroke={colors.accent} strokeWidth={2} />
      </g>
    );
  };
  return (
    <div data-testid="kpi-trend" data-kpi={kpi} className="relative" style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 16, left: -6, bottom: 0 }}>
          <CartesianGrid stroke={colors.line} vertical={false} />
          <XAxis dataKey="key" stroke={colors.muted} fontSize={12} tickLine={false} tickFormatter={(k: string) => byKey.get(k)?.label ?? k} minTickGap={14} />
          <YAxis stroke={colors.muted} fontSize={12} width={46} tickLine={false} allowDecimals={kpi === 'hours' || kpi === 'extra'}
            domain={kpi === 'onTime' ? [0, 100] : [0, (max: number) => Math.max(kpi === 'resubmits' ? 2 : 1, Math.ceil(max * 1.15))]} tickFormatter={yTick(kpi)} />
          <Tooltip cursor={{ stroke: colors.line, strokeWidth: 1 }}
            content={<ChartTooltip labelFormatter={(k) => { const d = byKey.get(String(k)); return d ? `${d.title}${d.partial ? ' (so far)' : ''}` : String(k); }}
              valueFormatter={(v) => fmtKpi(kpi, Number(v))} />} />
          {kpi === 'onTime' && <ReferenceLine y={80} stroke={colors.muted} strokeDasharray="4 4" />}
          <Line type="monotone" dataKey="v" name={KPI_LABEL[kpi]} stroke={colors.accent} strokeWidth={3} connectNulls dot={renderDot} activeDot={{ r: 6, stroke: colors.surface, strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      {!hasData && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">Nothing recorded for this KPI yet.</p>}
    </div>
  );
}

/** Tiny trend line for table rows (no axes). Nulls leave a gap; the last point gets a dot. */
export function Sparkline({ values, label, color }: { values: (number | null)[]; label: string; color: string }) {
  const w = 88, h = 26, pad = 3;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <span className="text-xs text-muted">Not enough data</span>;
  const min = Math.min(...nums), max = Math.max(...nums), span = max - min || 1;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(1, values.length - 1);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - 2 * pad);
  let d = '', pen = false, last = -1;
  values.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
    last = i;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="block overflow-visible">
      <title>{label}</title>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {last >= 0 && <circle cx={x(last)} cy={y(values[last]!)} r={3} fill={color} />}
    </svg>
  );
}

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/** Keeps the top n slices and folds the rest into "Other". */
function fold(rows: TimeSlice[], n: number): TimeSlice[] {
  if (rows.length <= n) return rows;
  const rest = rows.slice(n - 1).reduce((s, r) => s + r.minutes, 0);
  return [...rows.slice(0, n - 1), { id: 'other-rest', label: 'Other', minutes: rest }];
}

function TimeBars({ title, rows, total, color }: { title: string; rows: TimeSlice[]; total: number; color: (id: string) => string }) {
  const colors = useChartColors();
  const data = rows.map((r) => ({ ...r, minutes: Math.round(r.minutes) }));
  const share = (m: number) => (total ? Math.round((m / total) * 100) : 0);
  return (
    <figure className="min-w-0" data-testid={`time-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <figcaption className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{title}</figcaption>
      <div style={{ height: data.length * 34 + 6 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 96, bottom: 0, left: 0 }} barCategoryGap={8}>
            <XAxis type="number" hide domain={[0, 'dataMax']} />
            <YAxis type="category" dataKey="label" width={180} tickLine={false} axisLine={false} interval={0}
              tick={(p: { x: number; y: number; payload: { value: string } }) => (
                <text x={p.x} y={p.y} dy={4} textAnchor="end" fill={colors.ink} fontSize={12} className="recharts-cartesian-axis-tick-value">
                  <title>{p.payload.value}</title>{trunc(p.payload.value, 28)}
                </text>
              )} />
            <Tooltip cursor={{ fill: colors.surface2 }}
              content={<ChartTooltip valueFormatter={(v) => `${fmtMin(Number(v))} (${share(Number(v))}%)`} />} />
            <Bar dataKey="minutes" name="Time" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
              {data.map((d) => <Cell key={d.id} fill={color(d.id)} />)}
              <LabelList dataKey="minutes" content={(p) => {
                const { x = 0, y = 0, width = 0, height = 0, value = 0 } = p as { x?: number; y?: number; width?: number; height?: number; value?: number };
                const v = Number(value);
                return (
                  <text x={Number(x) + Number(width) + 6} y={Number(y) + Number(height) / 2} dy={4} fill={colors.muted} fontSize={12} className="tabular-nums">
                    {`${fmtMin(v)} · ${share(v)}%`}
                  </text>
                );
              }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/**
 * "Where time goes": time on submitted tasks plus extra hours, by project and by task type, for one person or the team.
 * Returns the total so callers can show it in their heading.
 */
export function WhereTimeGoes({ personId, from, to, emptyText = 'No time recorded in this period yet.' }: { personId?: string; from: string; to: string; emptyText?: string }) {
  const slice = useSlice();
  const colors = useChartColors();
  const projectColor = useProjectColor();
  const split = useMemo(() => timeSplit(slice, { personId, from, to }), [slice, personId, from, to]);
  return (
    <div data-testid="where-time-goes" data-total={split.totalMin}>
      {split.totalMin === 0 ? (
        <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{emptyText}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            <b className="text-base text-ink tabular-nums">{fmtMin(Math.round(split.totalMin))}</b> recorded: time on submitted tasks plus extra hours.
          </p>
          <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
            <TimeBars title="By project" rows={fold(split.byProject, 6)} total={split.totalMin} color={projectColor} />
            <TimeBars title="By task type" rows={fold(split.byType, 8)} total={split.totalMin} color={(id) => (id === 'extra' ? colors.butter : colors.accent)} />
          </div>
        </>
      )}
    </div>
  );
}

/** Diverging colours: looser than standard (cool), standard (neutral), tighter than standard (warm). */
const MIX_TEXT = '#0F172A';
export function AssignmentMix({ from, to, assignedBy, onOpen }: { from: string; to: string; assignedBy?: string; onOpen?: (id: string) => void }) {
  const tasks = useStore((s) => s.tasks);
  const colors = useChartColors();
  const rows = useMemo(() => {
    const all = assignmentMixByAssigner({ tasks }, { from, to });
    return assignedBy ? all.filter((r) => r.assignerId === assignedBy) : all;
  }, [tasks, from, to, assignedBy]);
  const segs = [
    { k: 'easy' as const, label: 'Easy', hint: `more than ${DIFFICULTY_BAND}% extra time`, fill: colors.butter },
    { k: 'standard' as const, label: 'Standard', hint: `within ${DIFFICULTY_BAND}% of standard`, fill: colors.sky },
    { k: 'challenging' as const, label: 'Challenging', hint: `more than ${DIFFICULTY_BAND}% less time`, fill: colors.coral },
  ];
  if (!rows.length) return <p className="rounded-xl bg-surface-2 px-4 py-5 text-center text-sm text-muted">No tasks assigned in this period.</p>;
  return (
    <div data-testid="assignment-mix">
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
        {segs.map((s) => (
          <li key={s.k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.fill }} /><b className="text-ink">{s.label}</b> {s.hint}</li>
        ))}
      </ul>
      <ul className="space-y-2.5">
        {rows.map((r) => {
          const summary = segs.map((s) => `${r.pct[s.k]}% ${s.label.toLowerCase()}`).join(', ');
          const who = (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar id={r.assignerId} size="sm" />
              <span className="min-w-0"><span className="block truncate text-sm font-semibold">{nameOf(r.assignerId)}</span><span className="block text-[11px] text-muted">{r.total} task{r.total === 1 ? '' : 's'}</span></span>
            </span>
          );
          return (
            <li key={r.assignerId} data-assigner={r.assignerId} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)] items-center gap-3">
              {onOpen ? <button type="button" className="focus-ring rounded-lg text-left" onClick={() => onOpen(r.assignerId)}>{who}</button> : who}
              <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded-md bg-surface" role="img" aria-label={`${nameOf(r.assignerId)}: ${summary}`} title={summary}>
                {segs.map((s) => r[s.k] > 0 && (
                  <div key={s.k} className={cx('flex h-full items-center justify-center text-[11px] font-bold tabular-nums first:rounded-l-md last:rounded-r-md')}
                    style={{ width: `${(r[s.k] / r.total) * 100}%`, background: s.fill, color: MIX_TEXT }}>
                    {r[s.k] / r.total >= 0.12 ? `${r.pct[s.k]}%` : ''}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
