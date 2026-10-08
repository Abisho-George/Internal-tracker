import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from '@/components';
import type { DailyNote } from '@/store';
import { useChartColors } from '@/theme/useChartColors';
import { CHART_MARGIN, ChartLegend, axisProps, gridProps, niceTicks } from './chartKit';
import { shortDay, weekOf } from './shared';

export interface TrendPoint {
  weekStart: string;
  label: string;
  /** Time vs standard %, null when nothing was logged that week. */
  pct: number | null;
  notes: DailyNote[];
}

interface DotProps {
  key?: string;
  cx?: number;
  cy?: number;
  index: number;
  payload?: TrendPoint;
}

interface ActiveMarker {
  index: number;
  x: number;
  y: number;
  source: 'hover' | 'focus';
}

const POPOVER_HALF = 136;

/**
 * One person's weekly "time vs standard" against their own average and the 100%
 * standard. Weeks with daily notes get a lavender note marker that reveals the
 * note(s) on hover and on keyboard focus.
 */
export function PersonTrendChart({ points, average, firstName }: { points: TrendPoint[]; average: number; firstName: string }) {
  const colors = useChartColors();
  const popId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<ActiveMarker | null>(null);
  const [ringIndex, setRingIndex] = useState<number | null>(null);

  // Positions go stale when the chart resizes; just close the popover.
  useEffect(() => {
    if (!active) return;
    const close = () => setActive(null);
    window.addEventListener('resize', close);
    return () => window.removeEventListener('resize', close);
  }, [active]);

  const values = points.map((p) => p.pct).filter((v): v is number => v != null);
  const lo = Math.min(100, average || 100, ...values);
  const hi = Math.max(100, average || 100, ...values);
  const axis = niceTicks(Math.max(0, lo - 5), hi + 5, 4);

  const activePoint = active ? points[active.index] : undefined;

  const open = (index: number, x: number, y: number, source: ActiveMarker['source']) => setActive({ index, x, y, source });

  const renderDot = (raw: unknown) => {
    const { key, cx, cy, index, payload } = raw as DotProps;
    if (cx == null || cy == null || !payload || payload.pct == null) return <g key={key ?? `dot-${index}`} />;
    if (payload.notes.length === 0) {
      return (
        <circle key={key ?? `dot-${index}`} cx={cx} cy={cy} r={4} fill={colors.surface} stroke={colors.sky} strokeWidth={2} />
      );
    }
    const isOpen = active?.index === index;
    const label = `${payload.notes.length === 1 ? 'Daily note' : `${payload.notes.length} daily notes`}, week of ${payload.label}`;
    const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
      if (e.key === 'Escape') setActive(null);
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setActive((a) => (a?.index === index ? null : { index, x: cx, y: cy, source: 'focus' }));
      }
    };
    return (
      <g
        key={key ?? `dot-${index}`}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? popId : undefined}
        data-note-week={payload.weekStart}
        style={{ cursor: 'pointer', outline: 'none' }}
        onMouseEnter={() => open(index, cx, cy, 'hover')}
        onMouseLeave={() => setActive((a) => (a?.source === 'hover' && a.index === index ? null : a))}
        onFocus={(e) => {
          if ((e.target as Element).matches?.(':focus-visible')) setRingIndex(index);
          open(index, cx, cy, 'focus');
        }}
        onBlur={() => {
          setRingIndex(null);
          setActive((a) => (a?.index === index ? null : a));
        }}
        onKeyDown={onKeyDown}
      >
        <circle cx={cx} cy={cy} r={16} fill="transparent" />
        {ringIndex === index && <circle cx={cx} cy={cy} r={14} fill="none" stroke={colors.accent} strokeWidth={2.5} />}
        <circle cx={cx} cy={cy} r={isOpen ? 11 : 10} fill={colors.lavender} stroke={colors.surface} strokeWidth={2} />
        <rect x={cx - 3.6} y={cy - 4.6} width={7.2} height={9.2} rx={1.6} fill={colors.surface} />
        <line
          x1={cx - 1.9}
          y1={cy - 1.6}
          x2={cx + 1.9}
          y2={cy - 1.6}
          stroke={colors.lavender}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
        <line
          x1={cx - 1.9}
          y1={cy + 1.1}
          x2={cx + 1.9}
          y2={cy + 1.1}
          stroke={colors.lavender}
          strokeWidth={1.2}
          strokeLinecap="round"
        />
      </g>
    );
  };

  const renderActiveDot = (raw: unknown) => {
    const { cx, cy, payload } = raw as DotProps;
    if (cx == null || cy == null || !payload) return <g />;
    if (payload.notes.length) return <circle cx={cx} cy={cy} r={14} fill="none" stroke={colors.lavender} strokeWidth={2} />;
    return <circle cx={cx} cy={cy} r={6} fill={colors.sky} stroke={colors.surface} strokeWidth={2} />;
  };

  // Keep the popover inside the chart horizontally; flip below when near the top.
  const width = wrapRef.current?.clientWidth ?? 0;
  let shiftX = '-50%';
  if (active && active.x < POPOVER_HALF) shiftX = `-${Math.max(4, active.x - 4)}px`;
  else if (active && width && active.x > width - POPOVER_HALF) shiftX = `calc(-100% + ${Math.max(4, width - active.x - 4)}px)`;
  const below = !!active && active.y < 150;

  return (
    <div>
      <ChartLegend
        className="mb-3"
        items={[
          { label: `${firstName}'s time vs standard`, color: colors.sky, mark: 'line' },
          { label: `Own average (${average}%)`, color: colors.peach, mark: 'dashed' },
          { label: 'Standard (100%)', color: colors.grey, mark: 'dotted' },
          { label: 'Daily note (hover or focus)', color: colors.lavender, mark: 'note', inner: colors.surface },
        ]}
      />
      <div ref={wrapRef} className="relative" data-testid="person-trend-chart">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={points} margin={{ ...CHART_MARGIN, top: 20, right: 20 }}>
            <CartesianGrid {...gridProps(colors)} />
            <XAxis dataKey="label" {...axisProps(colors)} interval="preserveStartEnd" padding={{ left: 16, right: 16 }} />
            <YAxis
              {...axisProps(colors)}
              domain={axis.domain}
              ticks={axis.ticks}
              tickFormatter={(v: number) => `${v}%`}
              width={48}
            />
            <ReferenceLine y={100} stroke={colors.grey} strokeDasharray="1.5 4" strokeWidth={2} ifOverflow="extendDomain" />
            {average > 0 && <ReferenceLine y={average} stroke={colors.peach} strokeDasharray="6 4" strokeWidth={2} />}
            <Line
              key="trend"
              type="monotone"
              dataKey="pct"
              name="Time vs standard"
              stroke={colors.sky}
              strokeWidth={2.5}
              connectNulls={false}
              dot={renderDot}
              activeDot={renderActiveDot}
              // No draw-in animation: Recharts re-animates (and briefly unmounts the dots)
              // whenever the chart re-renders, which would steal focus from a note marker.
              isAnimationActive={false}
            />
            {/* Last child, so toggling it never shifts the Line's position (and remounts the markers). */}
            {!active && (
              <Tooltip
                cursor={{ stroke: colors.line, strokeWidth: 1.5 }}
                content={
                  <ChartTooltip
                    labelFormatter={(l) => `Week of ${String(l)}`}
                    valueFormatter={(v) => `${v}% of standard`}
                    footer={(payload) => {
                      const p = payload?.[0]?.payload as TrendPoint | undefined;
                      if (!p?.notes.length) return null;
                      return (
                        <ul className="space-y-1">
                          {p.notes.map((n) => (
                            <li key={n.id}>
                              <span className="font-semibold text-lavender-ink">📝 {shortDay(n.date)}:</span> {n.text}
                            </li>
                          ))}
                        </ul>
                      );
                    }}
                  />
                }
              />
            )}
          </LineChart>
        </ResponsiveContainer>

        {active && activePoint && activePoint.notes.length > 0 && (
          <div
            id={popId}
            role="tooltip"
            data-testid="note-popover"
            className="pointer-events-none absolute z-10 w-64 rounded-xl border border-line/80 bg-surface px-3.5 py-3 text-xs shadow-lift"
            style={{
              left: active.x,
              top: below ? active.y + 18 : active.y - 18,
              transform: `translate(${shiftX}, ${below ? '0' : '-100%'})`,
            }}
          >
            <p className="font-semibold text-ink">
              {weekOf(activePoint.weekStart)} · {activePoint.pct}% of standard
            </p>
            <ul className="mt-2 space-y-2">
              {activePoint.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-lavender-soft px-2.5 py-2">
                  <p className="font-semibold text-lavender-ink">📝 {shortDay(n.date)}</p>
                  <p className="mt-0.5 leading-snug text-ink">{n.text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
