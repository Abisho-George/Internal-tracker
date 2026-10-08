import { useId } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartLine, ChartNoAxesColumn } from 'lucide-react';
import type { WeekStats } from '@/store';
import { Card, ChartTooltip, RatingChip, SectionHeader } from '@/components';
import { useChartColors } from '@/theme/useChartColors';
import { weekOfLabel } from './helpers';

const AXIS_TICK = { fontSize: 11 } as const;

/** Round y-axis ticks (0, 10, 20…) that cover `max`. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1, 2];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((x) => x >= rough) ?? 10 * pow;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** Chart x labels: the Monday, with the current week called "This week". */
function chartLabel(w: WeekStats, i: number, all: WeekStats[]): string {
  return i === all.length - 1 ? 'This week' : w.label;
}

/** Weekly "time vs standard" over 8 weeks, with a 100% "Standard" reference line. */
export function TimeVsStandardChart({ series }: { series: WeekStats[] }) {
  const c = useChartColors();
  const tableId = useId();
  const points = series.map((w, i, all) => ({
    label: chartLabel(w, i, all),
    weekStart: w.weekStart,
    pct: w.tasksDone > 0 ? w.timeVsStandardPct : null,
  }));
  const values = points.map((p) => p.pct).filter((v): v is number => v != null);
  const lo = Math.min(80, ...values.map((v) => Math.floor((v - 5) / 10) * 10));
  const hi = Math.max(120, ...values.map((v) => Math.ceil((v + 5) / 10) * 10));
  const first = values[0];
  const last = values[values.length - 1];

  return (
    <Card className="flex flex-col p-5 sm:p-6" data-testid="chart-time-vs-standard">
      <SectionHeader
        title="Time vs standard"
        description="Your last 8 weeks. 100% is exactly on standard — lower means quicker."
        icon={ChartLine}
        tone="lavender"
      />
      <div
        className="h-64 w-full"
        role="img"
        aria-label={
          values.length
            ? `Line chart of your weekly time vs standard over 8 weeks, from ${first}% to ${last}% of standard time.`
            : 'Line chart of your weekly time vs standard — no weeks logged yet.'
        }
        aria-describedby={tableId}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 12, right: 30, bottom: 0, left: -4 }}>
            <CartesianGrid stroke={c.line} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ ...AXIS_TICK, fill: c.muted }}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickMargin={8}
            />
            <YAxis
              domain={[lo, hi]}
              tick={{ ...AXIS_TICK, fill: c.muted }}
              tickFormatter={(v: number) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <ReferenceLine
              y={100}
              stroke={c.faint}
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: 'Standard', position: 'insideTopRight', fill: c.muted, fontSize: 11, fontWeight: 600 }}
            />
            <ReTooltip
              cursor={{ stroke: c.line, strokeWidth: 1 }}
              content={
                <ChartTooltip
                  labelFormatter={(label) => {
                    const p = points.find((x) => x.label === label);
                    return p ? `${weekOfLabel(p.weekStart)}${label === 'This week' ? ' (so far)' : ''}` : String(label);
                  }}
                  valueFormatter={(v) => `${v}% of standard`}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="pct"
              name="Time vs standard"
              stroke={c.lavender}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls
              dot={{ r: 4, fill: c.lavender, stroke: c.surface, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: c.lavender, stroke: c.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table id={tableId} className="sr-only">
        <caption>Weekly time vs standard</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Time vs standard</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.weekStart}>
              <th scope="row">{weekOfLabel(p.weekStart)}</th>
              <td>{p.pct == null ? 'No tasks logged' : `${p.pct}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

interface SegmentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  payload?: { top?: string };
}

/**
 * A stacked-bar segment: a 2px surface-coloured edge keeps neighbours apart, and
 * only the top-most non-empty segment of each bar gets the 4px rounded data end.
 */
function segmentShape(key: string) {
  return function Segment({ x = 0, y = 0, width = 0, height = 0, fill, stroke, payload }: SegmentProps) {
    if (height <= 0 || width <= 0) return <g />;
    const r = payload?.top === key ? Math.min(4, width / 2, height) : 0;
    const d = r
      ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
      : `M${x},${y} h${width} v${height} h${-width} Z`;
    return <path d={d} fill={fill} stroke={stroke} strokeWidth={2} />;
  };
}

const MIX_SERIES = [
  { key: 'better', rating: 'Better', color: 'mint' },
  { key: 'optimal', rating: 'Optimal', color: 'sky' },
  { key: 'canDoBetter', rating: 'Can do better', color: 'butter' },
] as const;

/** Weekly rating mix as stacked bars (Better / Optimal / Can do better). */
export function RatingMixChart({ series }: { series: WeekStats[] }) {
  const c = useChartColors();
  const tableId = useId();
  const points = series.map((w, i, all) => ({
    label: chartLabel(w, i, all),
    weekStart: w.weekStart,
    better: w.mix.better,
    optimal: w.mix.optimal,
    canDoBetter: w.mix.canDoBetter,
    top: w.mix.canDoBetter > 0 ? 'canDoBetter' : w.mix.optimal > 0 ? 'optimal' : 'better',
  }));
  const yTicks = niceTicks(Math.max(0, ...points.map((p) => p.better + p.optimal + p.canDoBetter)));

  return (
    <Card className="flex flex-col p-5 sm:p-6" data-testid="chart-rating-mix">
      <SectionHeader
        title="Rating mix by week"
        description="How your tasks were rated, week by week."
        icon={ChartNoAxesColumn}
        tone="mint"
      />
      <ul className="-mt-1 mb-3 flex flex-wrap gap-2" aria-label="Legend">
        {MIX_SERIES.map((s) => (
          <li key={s.key}>
            <RatingChip rating={s.rating} size="sm" />
          </li>
        ))}
      </ul>
      <div
        className="h-56 w-full"
        role="img"
        aria-label="Stacked bar chart of your weekly rating mix over 8 weeks."
        aria-describedby={tableId}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 8, right: 24, bottom: 0, left: -8 }} barCategoryGap="28%">
            <CartesianGrid stroke={c.line} strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ ...AXIS_TICK, fill: c.muted }}
              tickLine={false}
              axisLine={false}
              interval={0}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              domain={[0, yTicks[yTicks.length - 1]]}
              ticks={yTicks}
              tick={{ ...AXIS_TICK, fill: c.muted }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <ReTooltip
              cursor={{ fill: c.surface2, opacity: 0.6 }}
              content={
                <ChartTooltip
                  labelFormatter={(label) => {
                    const p = points.find((x) => x.label === label);
                    return p ? `${weekOfLabel(p.weekStart)}${label === 'This week' ? ' (so far)' : ''}` : String(label);
                  }}
                  valueFormatter={(v) => `${v} ${v === 1 ? 'task' : 'tasks'}`}
                />
              }
            />
            {MIX_SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.rating}
                stackId="mix"
                fill={c[s.color]}
                stroke={c.surface}
                strokeWidth={2}
                maxBarSize={24}
                shape={segmentShape(s.key)}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table id={tableId} className="sr-only">
        <caption>Weekly rating mix</caption>
        <thead>
          <tr>
            <th scope="col">Week</th>
            <th scope="col">Better</th>
            <th scope="col">Optimal</th>
            <th scope="col">Can do better</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.weekStart}>
              <th scope="row">{weekOfLabel(p.weekStart)}</th>
              <td>{p.better}</td>
              <td>{p.optimal}</td>
              <td>{p.canDoBetter}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
