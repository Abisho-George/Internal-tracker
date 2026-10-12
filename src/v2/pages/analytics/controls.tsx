// Shared analytics controls for People and Profile: granularity, KPI and period pickers, KPI tiles and change badges.
import { useMemo, type KeyboardEvent } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import {
  GRAN_LABEL, KPI_DIRECTION, KPI_HINT, KPI_LABEL, KPIS, fmtKpi, recentPeriods,
  type Gran, type Kpi, type KpiValues, type Period,
} from '../../analytics';
import { day } from '../../data';
import { useStore } from '../../store';
import { cx } from '../../ui';

/** The store data the analytics functions need, memoised so charts only recompute when it changes. */
export function useSlice() {
  const tasks = useStore((s) => s.tasks);
  const daily = useStore((s) => s.daily);
  const projects = useStore((s) => s.projects);
  return useMemo(() => ({ tasks, daily, projects }), [tasks, daily, projects]);
}

/** First day with any task (the start of the history), so pickers never offer empty periods. */
export function useEarliest(): string {
  const tasks = useStore((s) => s.tasks);
  return useMemo(() => tasks.reduce((m, t) => (t.date < m ? t.date : m), day(0)), [tasks]);
}

export const GRANS: Gran[] = ['day', 'week', 'month'];
/** How many points the trend line shows per granularity. */
export const seriesLength = (gran: Gran, monthsAvailable: number) => (gran === 'day' ? 20 : gran === 'week' ? 12 : Math.max(3, monthsAvailable));
/** Short header labels for tables. */
export const KPI_SHORT: Record<Kpi, string> = { onTime: 'On time', tasks: 'Tasks done', hours: 'Hours logged', extra: 'Extra hours', resubmits: 'Resubmits' };
export const TRACK_TITLE: Record<Gran, string> = { day: 'Day-by-day track', week: 'Week-by-week track', month: 'Month-by-month track' };
const PERIOD_NOUN: Record<Gran, string> = { day: 'day', week: 'week', month: 'month' };
export const periodNoun = (g: Gran) => PERIOD_NOUN[g];

export interface PeriodOption { period: Period; label: string }
function periodLabel(p: Period, i: number): string {
  if (p.gran === 'day') {
    if (i === 0) return p.key === day(0) ? `Today, ${p.title}` : `${p.title} (latest)`;
    return i === 1 ? `${p.title} (previous day)` : p.title;
  }
  if (p.gran === 'week') return i === 0 ? `This week, ${p.title}` : i === 1 ? `Last week, ${p.title}` : `Week of ${p.title}`;
  return i === 0 ? `This month, ${p.title}` : i === 1 ? `Last month, ${p.title}` : p.title;
}
/** Current period first, then the previous ones back to the start of the history. */
export function usePeriodOptions(gran: Gran, earliest: string): PeriodOption[] {
  return useMemo(() => {
    const count = gran === 'day' ? 15 : gran === 'week' ? 12 : 6;
    const list = recentPeriods(gran, count).reverse();
    const kept = list.filter((p, i) => i < 2 || p.to >= earliest);
    return kept.map((p, i) => ({ period: p, label: periodLabel(p, i) }));
  }, [gran, earliest]);
}

/** Pill radio group (arrow keys move the choice). */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'sm' }: {
  label: string; value: T; options: { id: T; label: string; title?: string }[]; onChange: (v: T) => void; size?: 'sm' | 'xs';
}) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.id === value);
    const n = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!n) return;
    e.preventDefault();
    const next = options[(i + n + options.length) % options.length];
    onChange(next.id);
    (e.currentTarget.querySelector(`[data-value="${next.id}"]`) as HTMLButtonElement | null)?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="inline-flex flex-wrap gap-0.5 rounded-2xl bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          data-value={o.id}
          aria-checked={value === o.id}
          tabIndex={value === o.id ? 0 : -1}
          title={o.title}
          onClick={() => onChange(o.id)}
          className={cx(
            'focus-ring whitespace-nowrap rounded-xl font-semibold transition',
            size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]',
            value === o.id ? 'bg-accent text-accent-on shadow-soft' : 'text-muted hover:bg-surface hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function GranToggle({ value, onChange }: { value: Gran; onChange: (g: Gran) => void }) {
  return <Segmented label="Granularity" value={value} onChange={onChange} options={GRANS.map((g) => ({ id: g, label: GRAN_LABEL[g] }))} />;
}
export function KpiPicker({ value, onChange }: { value: Kpi; onChange: (k: Kpi) => void }) {
  return <Segmented label="KPI" value={value} onChange={onChange} options={KPIS.map((k) => ({ id: k, label: KPI_LABEL[k], title: KPI_HINT[k] }))} />;
}
export function PeriodSelect({ options, index, onChange }: { options: PeriodOption[]; index: number; onChange: (i: number) => void }) {
  return (
    <select
      aria-label="Period"
      value={Math.min(index, options.length - 1)}
      onChange={(e) => onChange(Number(e.target.value))}
      className="focus-ring max-w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink"
    >
      {options.map((o, i) => <option key={o.period.key} value={i}>{o.label}</option>)}
    </select>
  );
}

/** Change between two values (null when either is missing), rounded to one decimal. */
export const changeOf = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : Math.round((a - b) * 10) / 10);
/** "+5 pts", "-2", "+1.5h", "No change". Uses a plain hyphen for minus. */
export function fmtChange(kpi: Kpi, v: number | null): string {
  if (v == null) return '';
  if (v === 0) return 'No change';
  const s = `${v > 0 ? '+' : '-'}${Math.abs(v)}`;
  return kpi === 'onTime' ? `${s} pts` : kpi === 'hours' || kpi === 'extra' ? `${s}h` : s;
}
/** Text colour for a change: green when it moved the good way, red the bad way, muted when neutral. */
export function changeTone(kpi: Kpi, v: number | null): string {
  const s = (v ?? 0) * KPI_DIRECTION[kpi];
  return s > 0 ? 'text-mint-ink' : s < 0 ? 'text-coral-ink' : 'text-muted';
}
export function Delta({ kpi, v, className }: { kpi: Kpi; v: number | null; className?: string }) {
  if (v == null) return <span className={cx('text-xs text-muted', className)}>No comparison</span>;
  if (v === 0) return <span className={cx('text-xs font-semibold text-muted', className)}>No change</span>;
  const Icon = v > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cx('inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold tabular-nums', changeTone(kpi, v), className)}>
      <Icon size={13} aria-hidden />{fmtChange(kpi, v)}
    </span>
  );
}
/** Value for display: "87%", "12", "7.5h", or "n/a" when on-time has nothing to measure. */
export function KpiValue({ kpi, v, className }: { kpi: Kpi; v: number | null | undefined; className?: string }) {
  if (v == null) return <span className={cx('text-muted', className)} title="No submitted tasks with time recorded">n/a</span>;
  return <span className={className}>{fmtKpi(kpi, v)}</span>;
}

/** Five KPI tiles for a period with the change vs the previous one. The selected KPI is outlined. */
export function KpiTiles({ cur, prev, selected, prevLabel, onSelect }: { cur: KpiValues; prev: KpiValues; selected: Kpi; prevLabel: string; onSelect?: (k: Kpi) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" aria-label="KPIs for the selected period">
      {KPIS.map((k) => {
        const body = (
          <>
            <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted">{KPI_LABEL[k]}</p>
            <p className="mt-1 text-2xl font-extrabold leading-none tabular-nums"><KpiValue kpi={k} v={cur[k]} /></p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <Delta kpi={k} v={changeOf(cur[k], prev[k])} />
              <span className="truncate text-[11px] text-muted" title={prevLabel}>vs {prev[k] == null ? 'n/a' : fmtKpi(k, prev[k])}</span>
            </p>
          </>
        );
        const cls = cx('min-w-0 rounded-2xl border p-3 text-left transition', k === selected ? 'border-accent bg-accent-soft/40 ring-1 ring-accent' : 'border-line bg-surface');
        return onSelect ? (
          <button key={k} type="button" data-kpi={k} aria-pressed={k === selected} title={`${KPI_HINT[k]}. Click to chart it.`} onClick={() => onSelect(k)} className={cx('focus-ring hover:border-accent', cls)}>{body}</button>
        ) : (
          <div key={k} data-kpi={k} title={KPI_HINT[k]} className={cls}>{body}</div>
        );
      })}
    </div>
  );
}
