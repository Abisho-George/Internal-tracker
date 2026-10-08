import type { ReactNode } from 'react';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';

export interface ChartTooltipProps extends Partial<TooltipProps<ValueType, NameType>> {
  /** Format each value, e.g. (v) => `${v}%`. */
  valueFormatter?: (value: ValueType, name: NameType | undefined) => ReactNode;
  /** Format the header label (usually the x value). */
  labelFormatter?: (label: unknown) => ReactNode;
  hideLabel?: boolean;
  /** Extra content under the rows (e.g. a daily note). */
  footer?: (payload: TooltipProps<ValueType, NameType>['payload']) => ReactNode;
}

/**
 * Theme-aware Recharts tooltip. Use as `<Tooltip content={<ChartTooltip valueFormatter={…} />} />`.
 * Recharts injects `active`, `payload` and `label`.
 */
export function ChartTooltip({ active, payload, label, valueFormatter, labelFormatter, hideLabel, footer }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const heading = labelFormatter ? labelFormatter(label) : label;
  const extra = footer?.(payload);
  return (
    <div className="min-w-[140px] max-w-[260px] rounded-xl border border-line/80 bg-surface px-3 py-2.5 text-xs shadow-lift">
      {!hideLabel && heading !== undefined && heading !== '' && (
        <p className="mb-1.5 font-semibold text-ink">{heading as ReactNode}</p>
      )}
      <ul className="space-y-1">
        {payload
          .filter((p) => p.value !== undefined && p.value !== null)
          .map((p, i) => (
            <li key={`${String(p.dataKey ?? p.name)}-${i}`} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-muted">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color ?? p.payload?.fill ?? p.stroke }}
                />
                <span className="truncate">{p.name}</span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">
                {valueFormatter ? valueFormatter(p.value as ValueType, p.name) : (p.value as ReactNode)}
              </span>
            </li>
          ))}
      </ul>
      {extra && <div className="mt-2 border-t border-line/70 pt-2 text-muted">{extra}</div>}
    </div>
  );
}
