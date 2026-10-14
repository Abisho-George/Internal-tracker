import { TargetsProgress } from './DayTaskLog';
import { useEffect, useState, type ReactNode } from 'react';
import { CalendarCheck2, CalendarRange, Check, Lock, Moon, Pencil, Sunrise } from 'lucide-react';
import { toast } from '@/components';
import { addDays, fmtDay, toMinutes, type Task } from '../data';
import { weekTime } from '../analytics';
import { emptyWeekly, first, useStore, type CustomRow, type DayBlock, type ExtraHours } from '../store';
import { Btn, Chip, cx, fmtMin, input, safe } from '../ui';
import { colorOf } from './Widgets';
import { BarList, CustomRows, dayHhmm, HoursStats, NoteView, PendingHint, targetsMet, weekLabel, weekRows } from './DailyViews';

export const SUBMITTED = (t: Task) => (t.status === 'done' || t.status === 'in_review') && t.minutes != null;

/** Monday and Friday (yyyy-MM-dd) of the week containing `date`. */
export function weekOf(date: string): [string, string] {
  const d = new Date(date + 'T00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const mon = iso(d);
  d.setDate(d.getDate() + 4);
  return [mon, iso(d)];
}

/** Header + locked / editing shell shared by the four update sections. */
export function UpdateSection({ id, icon, tone, title, subtitle, lockedAt, lockedLabel = 'Locked', editing, onEdit, children, view }: {
  id?: string; icon: ReactNode; tone: string; title: string; subtitle: string; lockedAt?: string; lockedLabel?: string; editing: boolean; onEdit?: () => void; children: ReactNode; view: ReactNode;
}) {
  const locked = !!lockedAt && !editing;
  return (
    <section id={id} aria-label={title} className="flex min-w-0 flex-col rounded-card bg-surface shadow-soft">
      <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-card border-b border-line px-5 py-3', tone)}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface/70">{icon}</span>
        <div className="min-w-[10rem] flex-1"><p className="font-bold">{title}</p><p className="text-xs text-muted">{subtitle}</p></div>
        {lockedAt ? <Chip tone="mint"><Lock size={11} /> {lockedLabel} {dayHhmm(lockedAt)}</Chip> : <Chip tone="butter">Not sent yet</Chip>}
      </div>
      <div className="flex-1 space-y-4 p-5">{locked ? view : children}</div>
      {locked && onEdit && <div className="border-t border-line px-5 py-3"><Btn tone="ghost" className="border border-line" onClick={onEdit}><Pencil size={13} /> Edit</Btn></div>}
    </section>
  );
}

/** One quiet line: "6 tasks · 4h 30m of work · 1 priority". */
export function TaskLine({ tasks, mode }: { tasks: Task[]; mode: 'assigned' | 'submitted' }) {
  if (!tasks.length) return null;
  if (mode === 'assigned') {
    const mins = tasks.reduce((s, t) => s + (t.targetMinutes || 0), 0);
    const pr = tasks.filter((t) => t.priority).length;
    return <p className="text-xs text-muted">{tasks.length} task{tasks.length === 1 ? '' : 's'} · {fmtMin(mins)} of work{pr ? ` · ${pr} priority` : ''}</p>;
  }
  const logged = tasks.reduce((s, t) => s + (t.minutes ?? 0), 0);
  const timed = tasks.filter((t) => t.minutes && t.doneQty && t.qty);
  const onTime = timed.filter((t) => t.minutes! <= t.targetMinutes * (t.doneQty! / t.qty)).length;
  return <p className="text-xs text-muted">{tasks.length} submitted · {fmtMin(logged)} logged{timed.length ? ` · ${onTime} of ${timed.length} on time` : ''}</p>;
}

/** Block by block: planned vs actual time, then extra hours. */
export function TimeBreakdown({ plan, extra, sent }: { plan: DayBlock[]; extra: ExtraHours[]; sent: boolean }) {
  const projects = useStore((s) => s.projects);
  const blocks = [...plan].filter((b) => b.id !== 'lunch').sort((a, b) => a.start.localeCompare(b.start));
  if (!blocks.length && !extra.length) return null;
  // Extra hours sit in time order with the plan's blocks; ones with only a duration go last.
  const rows: { at: string; b?: DayBlock; x?: ExtraHours }[] = [...blocks.map((b) => ({ at: b.start, b })), ...extra.map((x) => ({ at: x.start ?? '99', x }))].sort((a, b) => a.at.localeCompare(b.at));
  const th = 'pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted';
  return (
    <table className="w-full table-fixed text-sm" aria-label="Time">
      <colgroup><col className="hidden w-[6.5rem] sm:table-column" /><col /><col className="w-14 sm:w-16" /><col className="w-14 sm:w-16" /></colgroup>
      <thead><tr className="border-b border-line"><th className={cx(th, 'hidden text-left sm:table-cell')}>When</th><th className={cx(th, 'text-left')}>What</th><th className={cx(th, 'text-right')}>Planned</th><th className={cx(th, 'text-right')}>Actual</th></tr></thead>
      <tbody>
        {rows.map((r) => {
          if (r.x) {
            const x = r.x;
            return (
          <tr key={x.id} className="border-b border-line/70 last:border-0">
            <td className="hidden py-1.5 tabular-nums text-muted sm:table-cell">{x.start && x.end ? `${x.start} to ${x.end}` : 'Extra'}</td>
            <td className="truncate py-1.5 pr-2" title={x.work}>{x.start && x.end && <span className="block text-[11px] tabular-nums text-muted sm:hidden">{x.start} to {x.end}</span>}<span className="mr-1.5 rounded bg-lavender px-1.5 py-px text-[10px] font-bold text-lavender-ink">EXTRA</span>{x.work}{x.projectId && <span className="text-muted"> · {projects.find((p) => p.id === x.projectId)?.client}</span>}</td>
            <td />
            <td className="py-1.5 text-right font-semibold tabular-nums">{fmtMin(x.minutes)}</td>
          </tr>
            );
          }
          const b = r.b!;
          const planned = Math.max(0, toMinutes(b.end) - toMinutes(b.start));
          const actual = b.actualMinutes ?? (sent ? planned : undefined);
          const p = projects.find((x) => x.id === b.projectId);
          return (
            <tr key={b.id} className="border-b border-line/70">
              <td className="hidden py-1.5 tabular-nums text-muted sm:table-cell">{b.start} to {b.end}</td>
              <td className="truncate py-1.5 pr-2"><span className="block text-[11px] tabular-nums text-muted sm:hidden">{b.start} to {b.end}</span><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: b.custom ? (b.custom.priority ? '#DC2626' : '#64748B') : colorOf(projects, b.projectId) }} />{b.custom ? b.custom.title || 'Custom block' : p?.name ?? 'Project'}</td>
              <td className="py-1.5 text-right tabular-nums text-muted">{fmtMin(planned)}</td>
              <td className={cx('py-1.5 text-right font-semibold tabular-nums', actual != null && actual > planned && 'text-butter-ink')}>{actual != null ? fmtMin(actual) : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Planned / actual / extra hours for the week, with a line per working day. */
function WeekHours({ personId, mon }: { personId: string; mon: string }) {
  const daily = useStore((s) => s.daily);
  const wt = weekTime(daily, personId, mon);
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Hours this week</p>
      <HoursStats t={wt} sent={wt.days.some((d) => d.sent)} />
      <table className="w-full table-fixed text-xs" aria-label="Hours by day">
        <colgroup><col /><col className="w-12 sm:w-16" /><col className="w-12 sm:w-16" /><col className="w-12 sm:w-14" /><col className="w-16 sm:w-20" /></colgroup>
        <thead><tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted"><th className="pb-1 text-left font-semibold">Day</th><th className="pb-1 text-right font-semibold">Planned</th><th className="pb-1 text-right font-semibold">Actual</th><th className="pb-1 text-right font-semibold">Extra</th><th className="pb-1 text-right font-semibold">End of day</th></tr></thead>
        <tbody>
          {wt.days.map((d) => (
            <tr key={d.date} className="border-b border-line/60 last:border-0">
              <td className="truncate py-1 text-muted">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][wt.days.indexOf(d)]}<span className="hidden sm:inline"> {fmtDay(d.date)}</span></td>
              <td className="py-1 text-right tabular-nums">{d.plannedMin ? fmtMin(d.plannedMin) : ''}</td>
              <td className="py-1 text-right font-semibold tabular-nums">{d.sent || d.actualMin ? fmtMin(d.actualMin) : ''}</td>
              <td className="py-1 text-right tabular-nums">{d.extraMin ? fmtMin(d.extraMin) : ''}</td>
              <td className="py-1 text-right">{d.sent ? <span className="inline-flex items-center gap-0.5 font-semibold text-mint-ink"><Check size={11} /> Sent</span> : <span className="text-muted">{d.plannedMin ? 'Pending' : ''}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Weekly targets (bar-chart list, actual blank until end of week) + end-of-week update (hours, note, custom rows). */
export function WeeklySections({ personId, date }: { personId: string; date: string }) {
  const { tasks, weekly, daily, saveWeekly } = useStore();
  const [mon] = weekOf(date);
  const saved = weekly[`${personId}|${mon}`] ?? emptyWeekly();
  const [tNote, setTNote] = useState(saved.targetsNote);
  const [tCustom, setTCustom] = useState<CustomRow[]>(saved.targetsCustom);
  const [eNote, setENote] = useState(saved.eowNote);
  const [eCustom, setECustom] = useState<CustomRow[]>(saved.eowCustom);
  const [editT, setEditT] = useState(false);
  const [editE, setEditE] = useState(false);
  useEffect(() => {
    const w = useStore.getState().weekly[`${personId}|${mon}`] ?? emptyWeekly();
    setTNote(w.targetsNote); setTCustom(w.targetsCustom); setENote(w.eowNote); setECustom(w.eowCustom); setEditT(false); setEditE(false);
  }, [personId, mon]);
  const week = tasks.filter((t) => t.assigneeId === personId && t.date >= mon && t.date <= addDays(mon, 6));
  const all = weekRows(tasks, personId, mon, saved, undefined, daily);
  const taskOnly = all.rows.filter((r) => r.kind === 'task');
  const met = targetsMet(all.rows);
  const label = weekLabel(mon);
  const hint = <PendingHint>Actuals fill in when you send your end of week</PendingHint>;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <UpdateSection id="weekly-targets" icon={<CalendarRange size={18} className="text-sky-ink" />} tone="bg-sky/40" title="Weekly targets" subtitle={`Week of ${label} · from tasks assigned this week`}
        lockedAt={saved.targetsAt} editing={editT} onEdit={() => setEditT(true)}
        view={<>
          <TargetsProgress personId={personId} date={date} kind="week" />
          <TaskLine tasks={week} mode="assigned" />
          <NoteView label="Focus" text={saved.targetsNote} />
        </>}>
        <TargetsProgress personId={personId} date={date} kind="week" />
        <TaskLine tasks={week} mode="assigned" />
        <label className="block text-sm font-semibold">Focus for the week
          <textarea rows={2} className={cx(input, 'mt-1')} value={tNote} onChange={(e) => setTNote(e.target.value)} placeholder="e.g. 300 personalised L1s and 4 meetings booked" />
        </label>
        <CustomRows rows={tCustom} onChange={setTCustom} title="Custom targets" hint="any other weekly goal" />
        <Btn onClick={() => safe(() => { saveWeekly(personId, mon, { targetsNote: tNote, targetsCustom: tCustom.filter((r) => r.label.trim()), targetsAt: new Date().toISOString() }); setEditT(false); toast({ title: 'Weekly targets locked 📅', tone: 'success' }); })}><Lock size={13} /> Save & lock</Btn>
      </UpdateSection>

      <UpdateSection id="end-of-week" icon={<CalendarCheck2 size={18} className="text-mint-ink" />} tone="bg-mint/40" title="End of week update" subtitle={`Week of ${label} · actuals fill in from tasks you submitted`}
        lockedAt={saved.eowAt} lockedLabel="Sent" editing={editE} onEdit={() => setEditE(true)}
        view={<>
          {met.total > 0 && <p className="text-sm"><b>{met.met} of {met.total}</b> <span className="text-muted">weekly targets met</span></p>}
          <WeekHours personId={personId} mon={mon} />
          <NoteView label="How it went" text={saved.eowNote} />
        </>}>
        <WeekHours personId={personId} mon={mon} />
        <label className="block text-sm font-semibold">How did the week go?
          <textarea rows={2} className={cx(input, 'mt-1')} value={eNote} onChange={(e) => setENote(e.target.value)} placeholder="Wins, blockers, what moves to next week" />
        </label>
        <CustomRows rows={eCustom} onChange={setECustom} title="Custom results" hint="anything extra you did this week" suggest={tCustom} />
        <Btn onClick={() => safe(() => { saveWeekly(personId, mon, { eowNote: eNote, eowCustom: eCustom.filter((r) => r.label.trim()), eowAt: new Date().toISOString() }); setEditE(false); toast({ title: `Week wrapped up, have a good weekend ${first(personId)} 🎉`, tone: 'success' }); })}><Lock size={13} /> Send & lock</Btn>
      </UpdateSection>
    </div>
  );
}

export const SodIcon = <Sunrise size={18} className="text-butter-ink" />;
export const EodIcon = <Moon size={18} className="text-accent-ink" />;
