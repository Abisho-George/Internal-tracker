import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useChartColors } from '@/theme/useChartColors';
import { KPI_LABEL, KPIS, personSeries, shiftPeriod, TAG_LABEL, teamTable, type Gran, type Kpi, type KpiValues, type TeamRow } from '../analytics';
import { PEOPLE } from '../data';
import { nameOf } from '../store';
import { Avatar, Card, Chip, H2, cx } from '../ui';
import { AssignmentMix, Sparkline, WhereTimeGoes } from './analytics/charts';
import {
  changeOf, Delta, GranToggle, KPI_SHORT, KpiPicker, KpiValue, PeriodSelect, periodNoun, Segmented, useEarliest, usePeriodOptions, useSlice,
} from './analytics/controls';
import { PersonModal } from './analytics/PersonModal';

type SortCol = 'name' | Kpi | 'change' | 'tag';
type Dir = 'asc' | 'desc';
type RoleFilter = 'all' | 'pm' | 'resource';
const TAG_RANK = { acknowledge: 2, support: 0 } as const;
const roleOf = (id: string) => PEOPLE.find((p) => p.id === id)?.role;
const titleOf = (id: string) => PEOPLE.find((p) => p.id === id)?.title ?? '';

/** Team totals for the footer row: on-time over all timed tasks, sums for the rest. */
function teamTotals(rows: KpiValues[]): KpiValues {
  const sum = (k: keyof KpiValues) => rows.reduce((s, r) => s + ((r[k] as number | null) ?? 0), 0);
  const timed = sum('timed');
  const onTimeCount = sum('onTimeCount');
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    onTime: timed ? Math.round((onTimeCount / timed) * 100) : null, tasks: sum('tasks'), hours: r1(sum('hours')), extra: r1(sum('extra')),
    resubmits: sum('resubmits'), assigned: sum('assigned'), timed, onTimeCount,
  };
}

export default function People() {
  const slice = useSlice();
  const colors = useChartColors();
  const earliest = useEarliest();
  const [gran, setGran] = useState<Gran>('week');
  const [kpi, setKpi] = useState<Kpi>('onTime');
  // Early in the week the current week is too thin to judge: default to the last complete week until Thursday.
  const [idx, setIdx] = useState(() => { const d = new Date().getDay(); return d >= 1 && d <= 3 ? 1 : 0; });
  const [role, setRole] = useState<RoleFilter>('all');
  const [sort, setSort] = useState<{ col: SortCol; dir: Dir }>({ col: 'name', dir: 'asc' });
  const [open, setOpen] = useState<string | null>(null);

  const options = usePeriodOptions(gran, earliest);
  const i = Math.min(idx, options.length - 1);
  const period = options[i].period;
  const prev = shiftPeriod(period, -1);

  // Tags compare everyone in the same period, so compute on the whole team and filter for display.
  const all = useMemo(() => teamTable(slice, gran, period.key), [slice, gran, period.key]);
  const trends = useMemo(() => new Map(all.map((r) => [r.personId, personSeries(slice, r.personId, gran, kpi, 8, { end: period.key })])), [all, slice, gran, kpi, period.key]);

  const rows = useMemo(() => {
    const value = (r: TeamRow, col: SortCol): number | string | null =>
      col === 'name' ? r.name : col === 'change' ? r.change[kpi] : col === 'tag' ? (r.tag ? TAG_RANK[r.tag] : 1) : r[col];
    const list = all.filter((r) => role === 'all' || roleOf(r.personId) === role);
    return [...list].sort((a, b) => {
      const va = value(a, sort.col), vb = value(b, sort.col);
      if (va == null && vb == null) return a.name.localeCompare(b.name);
      if (va == null) return 1;
      if (vb == null) return -1;
      const c = typeof va === 'string' ? va.localeCompare(String(vb)) : va - (vb as number);
      return (sort.dir === 'asc' ? c : -c) || a.name.localeCompare(b.name);
    });
  }, [all, role, sort, kpi]);
  const totals = useMemo(() => teamTotals(rows), [rows]);
  const prevTotals = useMemo(() => teamTotals(rows.map((r) => r.prev)), [rows]);

  const ack = all.filter((r) => r.tag === 'acknowledge');
  const sup = all.filter((r) => r.tag === 'support');
  const noun = periodNoun(gran);

  const sortBy = (col: SortCol) => setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'name' ? 'asc' : 'desc' }));
  /** Sortable header cell (a plain render function so the button keeps focus across re-sorts). */
  const th = (col: SortCol, children: ReactNode, className?: string, hint?: string) => {
    const on = sort.col === col;
    const Icon = !on ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th key={col} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cx('px-2 py-2 font-bold', className)}>
        <button type="button" data-sort={col} title={hint} onClick={() => sortBy(col)} className={cx('focus-ring inline-flex items-center gap-1 whitespace-nowrap rounded-md uppercase tracking-wide hover:text-ink', on && 'text-ink')}>
          {children}<Icon size={12} aria-hidden className={on ? '' : 'opacity-50'} />
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">People</h1>
        <p className="text-sm text-muted">Everyone's daily, weekly and monthly progress: who to acknowledge, who needs support, and where the time goes.</p>
      </div>

      <Card className="!py-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="people-filters">
          <GranToggle value={gran} onChange={(g) => setGran(g)} />
          <PeriodSelect options={options} index={i} onChange={setIdx} />
          <span className="hidden h-6 w-px bg-line md:block" aria-hidden />
          <KpiPicker value={kpi} onChange={setKpi} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Showing <b className="text-ink">{period.title}</b>{period.partial ? ' (so far)' : ''}, compared with the previous {noun} ({prev.title}).
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {([['acknowledge', ack, 'Top performers this ' + noun], ['support', sup, 'May need support or training']] as const).map(([tag, list, sub]) => (
          <Card key={tag} className={cx('border-l-4', tag === 'acknowledge' ? 'border-mint-strong' : 'border-coral-strong')}>
            <div data-testid={`callout-${tag}`}>
              <H2 right={<span className="text-xs text-muted">{sub}</span>}>{TAG_LABEL[tag]}</H2>
              {list.length === 0 ? <p className="text-sm text-muted">Nobody in this {noun}.</p> : (
                <ul className="space-y-2">
                  {list.map((r) => (
                    <li key={r.personId}>
                      <button type="button" onClick={() => setOpen(r.personId)} className="focus-ring flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-surface-2">
                        <Avatar id={r.personId} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{nameOf(r.personId)}</span>
                          <span className="block text-xs text-muted">{r.tagReason}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <H2 right={
          <Segmented<RoleFilter> label="Who" size="xs" value={role} onChange={setRole}
            options={[{ id: 'all', label: 'Everyone' }, { id: 'pm', label: 'Project managers' }, { id: 'resource', label: 'Resources' }]} />
        }>Team, {period.title}</H2>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm" data-testid="team-table">
            <thead className="text-left text-[11px] text-muted">
              <tr className="border-b border-line">
                {th('name', 'Person', 'pl-1')}
                {KPIS.map((k) => th(k, KPI_SHORT[k], cx('text-right', k === kpi && 'bg-accent-soft/50 text-accent-ink'), KPI_LABEL[k]))}
                {th('change', 'vs previous', 'text-right', `Change in ${KPI_LABEL[kpi]} vs ${prev.title}`)}
                <th className="px-2 py-2 font-bold uppercase tracking-wide">Trend</th>
                {th('tag', 'Flag')}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => {
                const tr = trends.get(r.personId) ?? [];
                return (
                  <tr key={r.personId} data-person={r.personId} className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2" onClick={() => setOpen(r.personId)}>
                    <td className="py-2 pl-1 pr-2">
                      <button type="button" className="focus-ring flex items-center gap-2 rounded-lg text-left" onClick={(e) => { e.stopPropagation(); setOpen(r.personId); }}>
                        <Avatar id={r.personId} size="sm" />
                        <span><span className="font-semibold">{nameOf(r.personId)}</span><br /><span className="text-xs text-muted">{titleOf(r.personId)}</span></span>
                      </button>
                    </td>
                    {KPIS.map((k) => (
                      <td key={k} data-kpi={k} className={cx('px-2 py-2 text-right', k === kpi ? 'bg-accent-soft/50 text-base font-bold' : 'font-medium')}>
                        <KpiValue kpi={k} v={r[k]} />
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right" data-col="change"><Delta kpi={kpi} v={r.change[kpi]} /></td>
                    <td className="px-2 py-2">
                      <Sparkline values={tr.map((p) => p.value)} color={colors.accent}
                        label={`${KPI_LABEL[kpi]}, last ${tr.length} ${noun}s: ${tr.map((p) => (p.value == null ? 'n/a' : p.value)).join(', ')}`} />
                    </td>
                    <td className="px-2 py-2" data-col="tag">
                      {r.tag ? <span title={r.tagReason}><Chip tone={r.tag === 'acknowledge' ? 'mint' : 'coral'}>{TAG_LABEL[r.tag]}</Chip></span> : <span className="text-xs text-faint">{r.tagReason || 'None'}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="tabular-nums">
              <tr className="border-t-2 border-line text-muted" data-testid="team-total">
                <td className="py-2 pl-1 pr-2 text-xs font-bold uppercase tracking-wide">Team</td>
                {KPIS.map((k) => (
                  <td key={k} className={cx('px-2 py-2 text-right font-semibold text-ink', k === kpi && 'bg-accent-soft/50')}><KpiValue kpi={k} v={totals[k]} /></td>
                ))}
                <td className="px-2 py-2 text-right"><Delta kpi={kpi} v={changeOf(totals[kpi], prevTotals[kpi])} /></td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Click a column to sort, click a person for their profile. Flags compare each person with the team in the same {noun}. Hours logged is time recorded on submitted tasks; extra hours come from end-of-day updates.
        </p>
      </Card>

      <Card>
        <H2 right={<span className="text-xs text-muted">Team, {period.title}</span>}>Where time goes</H2>
        <WhereTimeGoes from={period.from} to={period.to} />
      </Card>

      <Card>
        <H2 right={<span className="text-xs text-muted">Tasks assigned for {period.title}</span>}>Assigned vs standard time, by assigner</H2>
        <AssignmentMix from={period.from} to={period.to} />
      </Card>

      <PersonModal personId={open} gran={gran} kpi={kpi} index={i} onClose={() => setOpen(null)} />
    </div>
  );
}
