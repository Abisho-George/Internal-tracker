import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { dayTime, isOnTime, KPI_LABEL, KPIS, teamTable, type Gran } from '../analytics';
import { day, fmtDay, isWorkingDay, MONTHS, parseDay, PEOPLE, previousWorkingDay, type Task } from '../data';
import { leaveOn, nameOf, useStore } from '../store';
import { LeaveChip } from './LeavePanel';
import { Avatar, Card, Chip, cx, fmtMin, H2, STATUS } from '../ui';
import { WhereTimeGoes } from './analytics/charts';
import { GranToggle, KPI_SHORT, KpiValue, usePeriodOptions, useEarliest, useSlice } from './analytics/controls';
import { colorOf } from './Widgets';

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const SUBMITTED = new Set(['in_review', 'done']);

/** One task as a compact line: project colour, title, status, time. */
function TaskLine({ t }: { t: Task }) {
  const projects = useStore((s) => s.projects);
  const st = STATUS[t.status];
  const ok = isOnTime(t);
  return (
    <li className="flex flex-wrap items-center gap-2 border-b border-line/70 py-1.5 text-sm last:border-0" data-task-line={t.id}>
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(projects, t.projectId) }} />
      <span className="min-w-0 flex-1 truncate font-medium first-letter:uppercase">{t.title}<span className="ml-1 text-xs font-normal text-muted">{projects.find((p) => p.id === t.projectId)?.name}</span></span>
      {t.minutes != null && <span className="text-xs tabular-nums text-muted">{fmtMin(t.minutes)} of {fmtMin(t.targetMinutes)}</span>}
      {ok != null && <Chip tone={ok ? 'mint' : 'peach'}>{ok ? 'On time' : 'Late'}</Chip>}
      <Chip tone={st.tone}>{st.label}</Chip>
    </li>
  );
}

/** Month calendar of a person's tasks: click a day to see what was assigned and what was submitted that day. */
function HistoryCalendar({ tasks, personId }: { tasks: Task[]; personId: string }) {
  const leaves = useStore((s) => s.profiles[personId]?.leaves ?? []);
  const leaveOf = (d: string) => leaves.find((l) => l.date === d);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [picked, setPicked] = useState(isWorkingDay(day(0)) ? day(0) : previousWorkingDay(day(0)));
  const assignedOn = useMemo(() => { const m = new Map<string, Task[]>(); tasks.forEach((t) => m.set(t.date, [...(m.get(t.date) ?? []), t])); return m; }, [tasks]);
  const submittedOn = useMemo(() => { const m = new Map<string, Task[]>(); tasks.forEach((t) => { if (t.submittedAt) { const d = t.submittedAt.slice(0, 10); m.set(d, [...(m.get(d) ?? []), t]); } }); return m; }, [tasks]);
  const firstDow = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
  const daysIn = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => iso(cursor.y, cursor.m, i + 1))];
  const shift = (n: number) => setCursor((c) => { const m = c.m + n; return { y: c.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  const a = assignedOn.get(picked) ?? [];
  const s = submittedOn.get(picked) ?? [];
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]" data-testid="history-calendar">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <button aria-label="Previous month" className="focus-ring rounded-lg p-1.5 hover:bg-surface-2" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
          <p className="text-sm font-bold">{MONTHS[cursor.m]} {cursor.y}</p>
          <button aria-label="Next month" className="focus-ring rounded-lg p-1.5 hover:bg-surface-2" onClick={() => shift(1)}><ChevronRight size={16} /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted">{WD.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} />;
            const na = assignedOn.get(d)?.length ?? 0;
            const ns = submittedOn.get(d)?.length ?? 0;
            return (
              <button key={d} data-day={d} onClick={() => setPicked(d)}
                title={leaveOf(d) ? (leaveOf(d)!.kind === 'half' ? 'Half day leave' : 'On leave') : undefined}
                className={cx('focus-ring flex h-11 flex-col items-center justify-center rounded-lg text-xs font-semibold transition-colors', picked === d ? 'bg-accent text-accent-on' : leaveOf(d) ? 'bg-lavender text-lavender-ink hover:bg-lavender/80' : na || ns ? 'bg-surface-2 hover:bg-accent-soft' : 'text-faint hover:bg-surface-2', d === day(0) && picked !== d && 'ring-1 ring-accent/60')}>
                {parseDay(d).getDate()}
                {(na > 0 || ns > 0) && <span className="mt-0.5 flex gap-0.5">{na > 0 && <span className={cx('h-1.5 w-1.5 rounded-full', picked === d ? 'bg-white' : 'bg-sky-strong')} />}{ns > 0 && <span className={cx('h-1.5 w-1.5 rounded-full', picked === d ? 'bg-white/70' : 'bg-mint-strong')} />}</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-2 flex gap-3 text-[11px] text-muted"><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-strong" />Assigned</span><span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-mint-strong" />Submitted</span><span><span className="mr-1 inline-block h-2 w-2 rounded bg-lavender" />Leave</span></p>
      </div>
      <div className="space-y-4">
        <p className="flex items-center gap-2 font-bold">{new Date(`${picked}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}<LeaveChip personId={personId} date={picked} /></p>
        {leaveOf(picked) && <p className="rounded-xl bg-lavender/40 px-3 py-2 text-sm" data-testid="leave-note">🌴 {leaveOf(picked)!.kind === 'half' ? 'On half day leave' : 'On leave'} this day{leaveOf(picked)!.note ? `: ${leaveOf(picked)!.note}` : ''}.</p>}
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Tasks assigned ({a.length})</p>
          {a.length ? <ul data-testid="day-assigned">{a.map((t) => <TaskLine key={t.id} t={t} />)}</ul> : <p className="text-sm text-muted">Nothing assigned for this day.</p>}
        </div>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Tasks submitted ({s.length})</p>
          {s.length ? <ul data-testid="day-submitted">{s.map((t) => <TaskLine key={t.id} t={t} />)}</ul> : <p className="text-sm text-muted">Nothing submitted on this day.</p>}
        </div>
      </div>
    </div>
  );
}

/** Managers and founders: one person's page with their performance, where time goes, task history, day-by-day track and current work. */
export default function PersonPage() {
  const { id = '' } = useParams();
  const slice = useSlice();
  const earliest = useEarliest();
  const { tasks, daily, profiles } = useStore();
  const person = PEOPLE.find((p) => p.id === id);
  const [gran, setGran] = useState<Gran>('week');
  const options = usePeriodOptions(gran, earliest);
  const rows = useMemo(() => options.map((o) => ({ o, r: teamTable(slice, gran, o.period.key, { people: [id] })[0] })), [options, slice, gran, id]);
  const [timeIdx, setTimeIdx] = useState(0);
  const timePeriod = options[Math.min(timeIdx, options.length - 1)]?.period;
  const mine = useMemo(() => tasks.filter((t) => t.assigneeId === id), [tasks, id]);
  const current = mine.filter((t) => t.status !== 'done').sort((a, b) => a.date.localeCompare(b.date));
  // Day-by-day: the last 10 working days.
  const days = useMemo(() => {
    const out: string[] = [];
    let d = isWorkingDay(day(0)) ? day(0) : previousWorkingDay(day(0));
    while (out.length < 10) { out.push(d); d = previousWorkingDay(d); }
    return out;
  }, []);

  if (!person) return <Card><p className="text-sm">Person not found. <Link className="font-semibold text-accent-ink" to="/people">Back to People</Link></p></Card>;
  return (
    <div className="space-y-6" data-testid="person-page">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/people" className="focus-ring flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-accent-ink hover:bg-surface-2"><ArrowLeft size={15} /> People</Link>
        <Avatar id={id} size="lg" />
        <div><h1 className="flex items-center gap-2 text-2xl font-bold">{nameOf(id)} <LeaveChip personId={id} date={day(0)} /></h1><p className="text-sm text-muted">{person.title}</p></div>
      </div>

      <Card>
        <H2 right={<GranToggle value={gran} onChange={(g) => { setGran(g); setTimeIdx(0); }} />}>Performance</H2>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm" data-testid="person-kpis">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
              <tr className="border-b border-line"><th className="px-2 py-2">{gran === 'day' ? 'Day' : gran === 'week' ? 'Week' : 'Month'}</th>{KPIS.map((k) => <th key={k} className="px-2 py-2 text-right" title={KPI_LABEL[k]}>{KPI_SHORT[k]}</th>)}<th className="px-2 py-2 text-right">Assigned</th></tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map(({ o, r }, i) => (
                <tr key={o.period.key} className={cx('border-b border-line/70 last:border-0', i === timeIdx && 'bg-accent-soft/40', 'cursor-pointer hover:bg-surface-2')} onClick={() => setTimeIdx(i)} title="Show where time went for this period">
                  <td className="px-2 py-1.5 font-medium">{o.label}</td>
                  {KPIS.map((k) => <td key={k} className="px-2 py-1.5 text-right"><KpiValue kpi={k} v={r?.[k]} /></td>)}
                  <td className="px-2 py-1.5 text-right text-muted">{r?.assigned ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {timePeriod && (
        <Card>
          <H2 right={<span className="text-xs text-muted">{options[Math.min(timeIdx, options.length - 1)].label} · click a row above to change</span>}>Where time goes</H2>
          <WhereTimeGoes personId={id} from={timePeriod.from} to={timePeriod.to} />
        </Card>
      )}

      <Card>
        <H2>Task history</H2>
        <HistoryCalendar tasks={mine} personId={id} />
      </Card>

      <Card>
        <H2 right={<span className="text-xs text-muted">Last 10 working days</span>}>Day by day</H2>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm" data-testid="day-by-day">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
              <tr className="border-b border-line">
                <th className="px-2 py-2">Day</th><th className="px-2 py-2 text-right">Assigned</th><th className="px-2 py-2 text-right">Submitted</th><th className="px-2 py-2 text-right">Approved</th>
                <th className="px-2 py-2 text-right">On time</th><th className="px-2 py-2 text-right">Planned</th><th className="px-2 py-2 text-right">Actual</th><th className="px-2 py-2 text-right">Extra</th><th className="px-2 py-2">End of day</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {days.map((d) => {
                const assigned = mine.filter((t) => t.date === d);
                const subm = mine.filter((t) => t.submittedAt?.slice(0, 10) === d && SUBMITTED.has(t.status));
                const appr = mine.filter((t) => t.approvedAt?.slice(0, 10) === d);
                const timed = subm.map(isOnTime).filter((x) => x != null);
                const on = timed.length ? Math.round((timed.filter(Boolean).length / timed.length) * 100) : null;
                const rec = daily[`${id}|${d}`];
                const tm = dayTime(rec);
                return (
                  <tr key={d} className="border-b border-line/70 last:border-0" data-day-row={d}>
                    <td className="px-2 py-1.5 font-medium">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseDay(d).getDay()]} {fmtDay(d)} <LeaveChip personId={id} date={d} /></td>
                    <td className="px-2 py-1.5 text-right">{assigned.length}</td>
                    <td className="px-2 py-1.5 text-right">{subm.length}</td>
                    <td className="px-2 py-1.5 text-right">{appr.length}</td>
                    <td className="px-2 py-1.5 text-right">{on == null ? <span className="text-muted">n/a</span> : `${on}%`}</td>
                    <td className="px-2 py-1.5 text-right text-muted">{tm.plannedMin ? fmtMin(tm.plannedMin) : '·'}</td>
                    <td className="px-2 py-1.5 text-right">{tm.actualMin ? fmtMin(tm.actualMin) : '·'}</td>
                    <td className="px-2 py-1.5 text-right">{tm.extraMin ? fmtMin(tm.extraMin) : '·'}</td>
                    <td className="px-2 py-1.5">{!rec?.eodAt && leaveOn(profiles, id, d) ? <span className="text-xs font-semibold text-lavender-ink">On leave</span> : rec?.eodAt ? <Chip tone="mint">Sent {new Date(rec.eodAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Chip> : <span className="text-xs text-muted">Not sent</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <H2 right={<span className="text-xs text-muted">{current.length} open</span>}>Current tasks</H2>
        {current.length === 0 ? <p className="text-sm text-muted">Nothing open right now.</p> : (
          <ul data-testid="current-tasks">
            {current.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 border-b border-line/70 py-1.5 text-sm last:border-0">
                <span className="w-24 shrink-0 text-xs text-muted">{t.date < day(0) ? `From ${fmtDay(t.date)}` : t.date === day(0) ? 'Today' : fmtDay(t.date)}</span>
                <ul className="min-w-0 flex-1"><TaskLine t={t} /></ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
