/**
 * Chart building blocks for the management screens: a card frame, an HTML legend
 * (identity is never colour-only) and recessive axis / grid props for Recharts.
 */
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, SectionHeader, cn } from '@/components';
import type { ChartColors } from '@/theme/useChartColors';

export interface ChartCardProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  tone?: 'mint' | 'sky' | 'peach' | 'lavender' | 'butter';
  legend?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Plain-language summary of the chart for screen readers. */
  summary?: string;
}

export function ChartCard({ title, description, icon, tone, legend, action, children, className, summary }: ChartCardProps) {
  return (
    <Card className={cn('flex min-w-0 flex-col p-5 sm:p-6', className)}>
      <SectionHeader title={title} description={description} icon={icon} tone={tone} as="h3" action={action} className="mb-3" />
      {legend && <div className="mb-3">{legend}</div>}
      {summary && <p className="sr-only">{summary}</p>}
      <div className="min-w-0 flex-1">{children}</div>
    </Card>
  );
}

export type LegendMark = 'line' | 'dashed' | 'dotted' | 'bar' | 'dot' | 'note';

export interface LegendItem {
  label: ReactNode;
  color: string;
  mark?: LegendMark;
  /** Inner glyph colour for the 'note' mark (usually the chart surface). */
  inner?: string;
}

/** Small swatch that mirrors how the series is drawn (line / dashed / bar / dot). */
function Swatch({ color, mark = 'line', inner }: { color: string; mark?: LegendMark; inner?: string }) {
  if (mark === 'bar') return <span aria-hidden className="h-3 w-3 shrink-0 rounded-[4px]" style={{ backgroundColor: color }} />;
  if (mark === 'dot')
    return <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />;
  if (mark === 'note') {
    return (
      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
        <circle cx="8" cy="8" r="7" fill={color} />
        <rect x="5" y="4" width="6" height="8" rx="1.4" fill={inner ?? 'currentColor'} />
        <line x1="6.4" y1="6.6" x2="9.6" y2="6.6" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        <line x1="6.4" y1="8.8" x2="9.6" y2="8.8" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    );
  }
  const dash = mark === 'dashed' ? '5 3' : mark === 'dotted' ? '1.5 3' : undefined;
  return (
    <svg aria-hidden width="20" height="8" viewBox="0 0 20 8" className="shrink-0">
      <line x1="1" y1="4" x2="19" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={dash} />
    </svg>
  );
}

export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-muted', className)}>
      {items.map((item, i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          <Swatch color={item.color} mark={item.mark} inner={item.inner} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Recessive axes: muted ticks, no axis lines or tick marks. */
export function axisProps(colors: ChartColors) {
  return {
    tick: { fill: colors.muted, fontSize: 12 },
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
  } as const;
}

export function gridProps(colors: ChartColors) {
  return { stroke: colors.line, strokeDasharray: '3 4', vertical: false } as const;
}

/** Label style for ReferenceLine labels (text tokens, never the series colour). */
export function refLabel(
  colors: ChartColors,
  value: string,
  position: 'insideTopRight' | 'insideBottomRight' | 'insideTopLeft' = 'insideTopRight',
) {
  return { value, position, fill: colors.muted, fontSize: 11, fontWeight: 600 } as const;
}

/** Standard chart margins. */
export const CHART_MARGIN = { top: 12, right: 12, bottom: 4, left: 0 };

/**
 * "Nice" axis: a round step (1, 2, 2.5, 5 × 10^n) and evenly spaced ticks that
 * cover [lo, hi]. `integer` keeps steps whole (counts of things).
 */
export function niceTicks(lo: number, hi: number, count = 4, integer = false): { domain: [number, number]; ticks: number[] } {
  const low = Math.min(lo, hi);
  let high = Math.max(lo, hi);
  if (high - low < 1e-9) high = low + (integer ? count : 1);
  const raw = (high - low) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const steps = integer ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  let step = (steps.find((n) => norm <= n) ?? 10) * mag;
  if (integer) step = Math.max(1, Math.round(step));
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { domain: [start, end], ticks };
}
