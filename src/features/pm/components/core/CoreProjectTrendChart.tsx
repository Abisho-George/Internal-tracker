import { useReducedMotion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip } from '@/components';
import type { ProjectTargets, ProjectWeekPoint } from '@/store';
import { useChartColors } from '@/theme/useChartColors';

export interface CoreProjectTrendChartProps {
  series: ProjectWeekPoint[];
  targets: ProjectTargets;
}

type LevelKey = 'l1' | 'l2' | 'l3';

/**
 * Weekly trend for a project: L1/L2/L3 message volumes (one chart) and meetings
 * booked (a second chart — different scale, so never a second axis).
 * Lines carry a dash pattern + end label as well as colour.
 */
export function CoreProjectTrendChart({ series, targets }: CoreProjectTrendChartProps) {
  const c = useChartColors();
  const reduce = useReducedMotion();
  const animate = !reduce;
  const last = series.length - 1;

  const levels: { key: LevelKey; name: string; color: string; dash?: string; target: number }[] = [
    { key: 'l1', name: 'L1', color: c.sky, target: targets.weeklyMessagesL1 },
    { key: 'l2', name: 'L2', color: c.peach, dash: '7 4', target: targets.weeklyMessagesL2 },
    { key: 'l3', name: 'L3', color: c.lavender, dash: '2 4', target: targets.weeklyMessagesL3 },
  ];

  const axisTick = { fill: c.muted, fontSize: 11 };

  const endLabel = (name: string) =>
    function EndLabel(props: { x?: number | string; y?: number | string; index?: number }) {
      if (props.index !== last) return <g />;
      return (
        <text x={Number(props.x) + 9} y={Number(props.y)} dy={4} fontSize={11} fontWeight={700} fill={c.ink}>
          {name}
        </text>
      );
    };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      {/* Messages */}
      <figure className="min-w-0">
        <figcaption className="mb-1 text-sm font-semibold text-ink">Messages per week</figcaption>
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
          {levels.map((l) => (
            <li key={l.key} className="inline-flex items-center gap-1.5">
              <svg width="22" height="8" aria-hidden>
                <line x1="1" y1="4" x2="21" y2="4" stroke={l.color} strokeWidth={2.5} strokeDasharray={l.dash} strokeLinecap="round" />
              </svg>
              <span>
                <span className="font-semibold text-ink">{l.name}</span> · target {l.target}/wk
              </span>
            </li>
          ))}
        </ul>
        <div className="h-60" role="img" aria-label="Line chart of L1, L2 and L3 messages per week over the last 8 weeks">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 30, bottom: 0, left: -12 }}>
              <CartesianGrid vertical={false} stroke={c.line} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: c.line }} interval="preserveStartEnd" />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip
                content={<ChartTooltip labelFormatter={(l) => `Week of ${String(l)}`} valueFormatter={(v) => `${v} messages`} />}
                cursor={{ stroke: c.faint, strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              {levels.map((l) => (
                <Line
                  key={l.key}
                  type="monotone"
                  dataKey={l.key}
                  name={`${l.name} messages`}
                  stroke={l.color}
                  strokeWidth={2}
                  strokeDasharray={l.dash}
                  dot={{ r: 3.5, strokeWidth: 2, fill: c.surface, stroke: l.color }}
                  activeDot={{ r: 5.5, strokeWidth: 2, stroke: c.surface, fill: l.color }}
                  isAnimationActive={animate}
                  animationDuration={700}
                  label={endLabel(l.name)}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>

      {/* Meetings */}
      <figure className="min-w-0">
        <figcaption className="mb-1 text-sm font-semibold text-ink">Meetings booked per week</figcaption>
        <p className="mb-3 text-xs text-muted">
          Engagement target: <span className="font-semibold text-ink">{targets.meetingsTarget}</span> meetings
        </p>
        <div className="h-60" role="img" aria-label="Bar chart of meetings booked per week over the last 8 weeks">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke={c.line} />
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: c.line }} interval="preserveStartEnd" />
              <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip
                content={<ChartTooltip labelFormatter={(l) => `Week of ${String(l)}`} valueFormatter={(v) => `${v} booked`} />}
                cursor={{ fill: c.surface2 }}
              />
              <Bar
                dataKey="meetings"
                name="Meetings"
                fill={c.mint}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
                isAnimationActive={animate}
                animationDuration={700}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>

      {/* Table view of the same numbers */}
      <details className="group xl:col-span-2">
        <summary className="focus-ring inline-flex cursor-pointer select-none items-center gap-1 rounded-lg px-1 text-sm font-semibold text-accent-ink">
          View as table
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-line/70 text-left text-xs font-semibold uppercase tracking-wider text-muted">
                <th scope="col" className="py-2 pr-4">Week of</th>
                <th scope="col" className="py-2 pr-4 text-right">L1</th>
                <th scope="col" className="py-2 pr-4 text-right">L2</th>
                <th scope="col" className="py-2 pr-4 text-right">L3</th>
                <th scope="col" className="py-2 pr-4 text-right">Meetings</th>
                <th scope="col" className="py-2 text-right">Companies (total)</th>
              </tr>
            </thead>
            <tbody>
              {series.map((w) => (
                <tr key={w.weekStart} className="border-b border-line/40 last:border-0 tabular-nums">
                  <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">{w.label}</th>
                  <td className="py-2 pr-4 text-right text-ink">{w.l1}</td>
                  <td className="py-2 pr-4 text-right text-ink">{w.l2}</td>
                  <td className="py-2 pr-4 text-right text-ink">{w.l3}</td>
                  <td className="py-2 pr-4 text-right text-ink">{w.meetings}</td>
                  <td className="py-2 text-right text-ink">{w.companies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
