import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ClipboardList, Copy, Lock, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from '@/components';
import { addDays, canManage, previousWorkingDay, TASK_TYPES, toMinutes, weekStartOf, type Project } from '../data';
import { emptyDaily, emptyWeekly, useStore, type DayBlock, type ExtraHours, type TaskEntry } from '../store';
import { Bar, Btn, Card, Chip, cx, fmtMin, safe } from '../ui';
import { colorOf } from './Widgets';
import { DurationInput, hhmm } from './DailyViews';
import { WeekPlanner } from './Projects';

export type LogKind = 'day' | 'week';
const field = 'focus-ring w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink';
const num = 'focus-ring w-20 rounded-lg border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink';
const CUSTOM = '__custom';
let eid = 0;
const EDIT_EVENT = 'ls-edit-day-tasks';
/** Opens the daily update for editing and scrolls to it. */
export const editDayTasks = () => window.dispatchEvent(new Event(EDIT_EVENT));
const blockMin = (b: DayBlock) => Math.max(0, toMinutes(b.end) - toMinutes(b.start));
const newId = () => `e${Date.now().toString(36)}${eid++}`;
const blank = (projectId: string): TaskEntry => ({ id: newId(), projectId, task: '', desc: '', estMin: 0, achieved: '', remarks: '' });
const optionsFor = (p?: Project) => [...TASK_TYPES.map((t) => ({ id: t.id, name: t.name })), ...(p?.customStandards ?? []).map((c) => ({ id: `std:${c.id}`, name: c.name }))];
export const entryName = (e: TaskEntry, p?: Project) => (e.task === CUSTOM ? e.custom || 'Custom task' : optionsFor(p).find((o) => o.id === e.task)?.name ?? e.task);
const sameTask = (a: TaskEntry, b: TaskEntry) => a.projectId === b.projectId && a.task === b.task && (a.task !== CUSTOM || (a.custom ?? '').trim().toLowerCase() === (b.custom ?? '').trim().toLowerCase());
const n = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.round(+v || 0)));

/** Where a log lives: the day's daily update or the week's weekly update. */
function useLog(personId: string, kind: LogKind, date: string) {
  const { daily, weekly, saveDaily, saveWeekly } = useStore();
  const key = kind === 'day' ? date : weekStartOf(date);
  const rec = kind === 'day' ? daily[`${personId}|${key}`] ?? emptyDaily() : weekly[`${personId}|${key}`] ?? emptyWeekly();
  const prevKey = kind === 'day' ? previousWorkingDay(date) : addDays(key, -7);
  const prev = (kind === 'day' ? daily[`${personId}|${prevKey}`] : weekly[`${personId}|${prevKey}`])?.entries ?? [];
  const save = (patch: { entries: TaskEntry[]; entriesAt?: string; sodAt?: string }) => (kind === 'day' ? saveDaily(personId, key, patch) : saveWeekly(personId, key, patch));
  return { key, rec, prev, save, sodAt: kind === 'day' ? (rec as ReturnType<typeof emptyDaily>).sodAt : undefined };
}

/** A week's done count for a weekly row: what was typed, else the sum of matching rows in that week's daily updates. */
export function weekDone(e: TaskEntry, personId: string, mon: string, daily: ReturnType<typeof useStore.getState>['daily']): number | undefined {
  if (e.doneQty != null) return e.doneQty;
  const rows = [0, 1, 2, 3, 4].flatMap((i) => daily[`${personId}|${addDays(mon, i)}`]?.entries ?? []).filter((d) => sameTask(d, e) && d.doneQty != null);
  return rows.length ? rows.reduce((a, d) => a + (d.doneQty ?? 0), 0) : undefined;
}

/**
 * Daily or weekly update entry: a table per project (task, description, target, estimated, actual,
 * achieved, remarks) with totals. Daily tables come from the plan's blocks; weekly ones from the person's projects.
 */
export default function DayTaskLog({ personId, date, plan, extra, readOnly, kind = 'day' }: { personId: string; date: string; plan?: DayBlock[]; extra?: ExtraHours[]; readOnly?: boolean; kind?: LogKind }) {
  const { projects, daily } = useStore();
  const { key, rec, prev, save: persist, sodAt } = useLog(personId, kind, date);
  const saved = rec.entries ?? [];
  const blocks = plan ?? (kind === 'day' ? (rec as ReturnType<typeof emptyDaily>).plan : []);
  const extras = extra ?? (kind === 'day' ? (rec as ReturnType<typeof emptyDaily>).extra ?? [] : []);
  const [rows, setRows] = useState<TaskEntry[]>(saved);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setRows(saved); setEditing(false); }, [personId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!editing) setRows(saved); }, [rec.entries]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (readOnly || kind !== 'day') return;
    const open = () => { setEditing(true); document.getElementById('daily-update')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    window.addEventListener(EDIT_EVENT, open);
    return () => window.removeEventListener(EDIT_EVENT, open);
  }, [readOnly, kind]);
  const locked = !!rec.entriesAt && !editing;
  const list = readOnly ? saved : rows;
  const edit = !readOnly && !locked;
  const what = kind === 'day' ? 'day' : 'week';

  // Daily: projects in plan order with planned minutes. Weekly: every project the person is on, with weekly hours.
  const groups = useMemo(() => {
    const planned = new Map<string, number>();
    if (kind === 'day') {
      [...blocks].sort((a, b) => a.start.localeCompare(b.start)).forEach((b) => {
        const pid = b.custom ? b.custom.projectId ?? b.projectId : b.projectId;
        if (pid) planned.set(pid, (planned.get(pid) ?? 0) + blockMin(b));
      });
      // Extra hours count as time blocks for their project.
      extras.forEach((x) => {
        const m = x.start && x.end && x.end > x.start ? toMinutes(x.end) - toMinutes(x.start) : x.minutes;
        if (x.projectId) planned.set(x.projectId, (planned.get(x.projectId) ?? 0) + (m || 0));
      });
    } else {
      projects.filter((p) => p.status === 'active' && (p.pmId === personId || p.teamIds.includes(personId) || p.admins?.includes(personId)))
        .forEach((p) => planned.set(p.id, Math.round((p.hours[personId] ?? 0) * 60 * 5)));
    }
    list.forEach((e) => { if (!planned.has(e.projectId)) planned.set(e.projectId, 0); });
    return [...planned].map(([pid, min]) => ({ project: projects.find((p) => p.id === pid)!, pid, planned: min })).filter((g) => g.project);
  }, [kind, blocks, extras, list, projects, personId]);

  const upd = (id: string, p: Partial<TaskEntry>) => setRows((r) => r.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const fillFromPrev = (pid: string) => {
    const from = prev.filter((e) => e.projectId === pid);
    if (!from.length) { toast({ title: `Nothing saved for this project ${kind === 'day' ? 'on the previous day' : 'last week'}`, tone: 'info' }); return; }
    setRows((r) => [...r.filter((e) => e.projectId !== pid || e.task), ...from.map((e) => ({ ...e, id: newId(), actualMin: undefined, doneQty: undefined, achieved: '', remarks: '' }))]);
    toast({ title: `Copied ${from.length} task${from.length > 1 ? 's' : ''} from ${kind === 'day' ? 'the previous day' : 'last week'}`, tone: 'success' });
  };
  const save = (lock: boolean) => safe(() => {
    const keep = rows.filter((e) => e.task && (e.task !== CUSTOM || e.custom?.trim()));
    if (lock && !keep.length) throw new Error('Add at least one task before locking.');
    const at = new Date().toISOString();
    persist({ entries: keep, ...(lock ? { entriesAt: at, ...(kind === 'day' && !sodAt ? { sodAt: at } : {}) } : {}) });
    setRows(keep);
    setEditing(false);
    toast({ title: lock ? `${kind === 'day' ? 'Daily' : 'Weekly'} tasks locked 🔒` : 'Saved ✓', tone: 'success' });
  });
  const all = list.reduce((a, e) => ({ est: a.est + e.estMin, act: a.act + (e.actualMin ?? 0) }), { est: 0, act: 0 });
  const plannedAll = groups.reduce((a, g) => a + g.planned, 0);
  const mon = weekStartOf(date);

  return (
    <Card className="!p-0">
      <div id={readOnly ? undefined : kind === 'day' ? 'daily-update' : 'weekly-update'} className="flex scroll-mt-20 flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">{kind === 'day' ? <ClipboardList size={17} className="text-accent-ink" /> : <CalendarRange size={17} className="text-accent-ink" />}{kind === 'day' ? 'Daily update' : 'Weekly targets by project'}</h2>
          <p className="text-xs text-muted">{readOnly ? `Tasks per project for the ${what}.` : kind === 'day'
            ? 'One table for every project in your plan. Add the tasks with targets, lock them, then fill in actual time and how many got done.'
            : 'Set the week\'s tasks and targets for each project. Achieved adds up from your daily updates unless you type it.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rec.entriesAt ? <Chip tone="mint">Locked {hhmm(rec.entriesAt)}</Chip> : <Chip tone="grey">Not locked yet</Chip>}
          {!readOnly && locked && <Btn tone="ghost" className="border border-line" onClick={() => setEditing(true)}><Pencil size={13} /> Update tasks</Btn>}
        </div>
      </div>

      {groups.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">{readOnly ? `Nothing for this ${what}.` : kind === 'day' ? 'Add time blocks to your plan above and a table opens here for each project.' : 'You are not on any project yet.'}</p>}

      <div className="space-y-4 p-4">
        {groups.map(({ project, pid, planned }) => {
          const opts = optionsFor(project);
          const mine = list.filter((e) => e.projectId === pid);
          const est = mine.reduce((a, e) => a + e.estMin, 0);
          const act = mine.reduce((a, e) => a + (e.actualMin ?? 0), 0);
          const done = (e: TaskEntry) => (kind === 'week' ? weekDone(e, personId, mon, daily) : e.doneQty);
          return (
            <section key={pid} data-project-log={pid} data-kind={kind} className="overflow-hidden rounded-xl border border-line" style={{ borderLeft: `5px solid ${colorOf(projects, pid)}` }}>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-2/60 px-3 py-2">
                <p className="font-semibold">{project.name}</p>
                <span className="flex flex-wrap items-center gap-2">
                  {planned > 0 && <span className="text-xs text-muted">Planned <b className="text-ink">{fmtMin(planned)}</b></span>}
                  {edit && <button className="focus-ring flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-semibold text-accent-ink hover:bg-surface-2" onClick={() => fillFromPrev(pid)}>
                    <Copy size={11} /> Fill from {kind === 'day' ? 'previous day' : 'last week'}
                  </button>}
                </span>
              </div>
              {kind === 'week' && !readOnly && canManage(project, personId) && (
                <details className="border-b border-line px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-accent-ink">Project number targets for the week (shows on the Projects tab)</summary>
                  <div className="mt-2"><WeekPlanner p={project} date={date} /></div>
                </details>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm" aria-label={`${project.name} ${what} tasks`}>
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <th className="w-48 px-2 py-1.5">Task</th><th className="px-2 py-1.5">Description <span className="normal-case">(optional)</span></th>
                      <th className="w-20 px-2 py-1.5">Target</th><th className="w-24 px-2 py-1.5">Estimated</th><th className="w-24 px-2 py-1.5">Actual</th>
                      <th className="w-20 px-2 py-1.5">Achieved</th><th className="w-44 px-2 py-1.5">Remarks</th>{edit && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {mine.length === 0 && <tr><td colSpan={8} className="px-2 py-3 text-xs text-muted">No tasks yet.</td></tr>}
                    {mine.map((e) => {
                      const d = done(e);
                      return (
                        <tr key={e.id} data-entry={e.id} className="border-t border-line align-top">
                          <td className="px-2 py-1.5">
                            {!edit ? <span className="font-medium">{entryName(e, project)}</span> : <>
                              <select aria-label="Task" className={field} value={e.task} onChange={(x) => upd(e.id, { task: x.target.value })}>
                                <option value="">Pick a task</option>
                                {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                                <option value={CUSTOM}>Custom...</option>
                              </select>
                              {e.task === CUSTOM && <input aria-label="Custom task name" autoFocus className={cx(field, 'mt-1')} placeholder="Task name" value={e.custom ?? ''} onChange={(x) => upd(e.id, { custom: x.target.value })} />}
                            </>}
                          </td>
                          <td className="px-2 py-1.5">{!edit ? <span className="text-muted">{e.desc || '·'}</span>
                            : <input aria-label="Description" className={field} placeholder="e.g. CFO list" value={e.desc} onChange={(x) => upd(e.id, { desc: x.target.value })} />}</td>
                          <td className="px-2 py-1.5">{!edit ? <span className="tabular-nums">{e.qty ?? '·'}</span>
                            : <input aria-label="Target" type="number" min={0} className={num} placeholder="30" value={e.qty ?? ''} onChange={(x) => upd(e.id, { qty: n(x.target.value) })} />}</td>
                          <td className="px-2 py-1.5">{!edit ? <span className="tabular-nums">{fmtMin(e.estMin)}</span>
                            : <DurationInput label="Estimated time" className="w-24" placeholder="1h" value={e.estMin || undefined} onChange={(m) => upd(e.id, { estMin: m ?? 0 })} />}</td>
                          <td className="px-2 py-1.5">{readOnly ? <span className="tabular-nums">{e.actualMin != null ? fmtMin(e.actualMin) : '·'}</span>
                            : <DurationInput label="Actual time" className="w-24" placeholder="..." value={e.actualMin} onChange={(m) => upd(e.id, { actualMin: m ?? undefined })} />}</td>
                          <td className="px-2 py-1.5">{readOnly ? <span className="tabular-nums">{d ?? '·'}</span>
                            : <input aria-label="Achieved" type="number" min={0} className={num} placeholder={kind === 'week' && d != null ? String(d) : '0'} value={e.doneQty ?? ''} onChange={(x) => upd(e.id, { doneQty: n(x.target.value) })} />}</td>
                          <td className="px-2 py-1.5">{readOnly ? <span>{e.remarks || '·'}</span>
                            : <input aria-label="Remarks" className={field} placeholder="Anything to note" value={e.remarks} onChange={(x) => upd(e.id, { remarks: x.target.value })} />}</td>
                          {edit && <td className="py-1.5"><button aria-label="Remove task" className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => setRows((r) => r.filter((y) => y.id !== e.id))}><Trash2 size={14} /></button></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-surface-2/40 text-xs font-semibold">
                      <td className="px-2 py-2">{edit && <button className="focus-ring flex items-center gap-1 rounded-full border border-line px-3 py-1 text-accent-ink hover:bg-surface-2" onClick={() => setRows((r) => [...r, blank(pid)])}><Plus size={12} /> Add task</button>}</td>
                      <td className="px-2 py-2 text-right text-muted" colSpan={2}>Total</td>
                      <td className="px-2 py-2 tabular-nums" data-testid="est-total">{fmtMin(est)}{planned > 0 && est > planned && <span className="ml-1 text-coral-ink">over plan</span>}</td>
                      <td className="px-2 py-2 tabular-nums" data-testid="act-total">{fmtMin(act)}</td><td colSpan={3} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
          <p className="text-sm">{kind === 'day' ? 'Day' : 'Week'} total: planned <b>{fmtMin(plannedAll)}</b> · estimated <b data-testid={`${kind}-est`}>{fmtMin(all.est)}</b> · actual <b data-testid={`${kind}-act`}>{fmtMin(all.act)}</b></p>
          {!readOnly && (
            <span className="ml-auto flex gap-2">
              {locked
                ? <Btn onClick={() => save(false)}><Save size={13} /> {kind === 'day' ? 'Save end of day' : 'Save end of week'}</Btn>
                : <Btn onClick={() => save(true)}><Lock size={13} /> {rec.entriesAt ? 'Update and lock' : 'Lock tasks'}</Btn>}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

/** Targets against what got achieved (e.g. 233/322 with a percent bar), per task and per project, filled automatically. */
export function TargetsProgress({ personId, date, kind }: { personId: string; date: string; kind: LogKind }) {
  const { projects, daily, weekly } = useStore();
  const mon = weekStartOf(date);
  const list = (kind === 'day' ? daily[`${personId}|${date}`]?.entries : weekly[`${personId}|${mon}`]?.entries) ?? [];
  const done = (e: TaskEntry) => (kind === 'week' ? weekDone(e, personId, mon, daily) : e.doneQty) ?? 0;
  const counted = list.filter((e) => (e.qty ?? 0) > 0);
  const pids = [...new Set(list.map((e) => e.projectId))];
  const sum = (xs: TaskEntry[]) => xs.reduce((a, e) => ({ t: a.t + (e.qty ?? 0), d: a.d + Math.min(done(e), e.qty ?? 0) }), { t: 0, d: 0 });
  const total = sum(counted);
  const pct = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);
  const tone = (p: number) => (p >= 100 ? 'mint' : p >= 60 ? 'sky' : 'peach');
  const editBtn = <button type="button" className="focus-ring flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-accent-ink hover:bg-surface-2"
    onClick={() => (kind === 'day' ? editDayTasks() : document.getElementById('weekly-update')?.scrollIntoView({ behavior: 'smooth' }))}><Pencil size={11} /> Edit</button>;

  if (!list.length) return <div className="flex items-center justify-between rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted" data-progress={kind}>No {kind === 'day' ? 'daily' : 'weekly'} tasks entered yet.{editBtn}</div>;
  return (
    <div className="space-y-3 rounded-xl border border-line p-3" data-progress={kind}>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{kind === 'day' ? 'Today' : 'This week'}</span>
        <b className="tabular-nums" data-testid={`${kind}-progress`}>{total.d}/{total.t}</b>
        <span className="flex-1"><Bar value={total.d} max={total.t} tone={tone(pct(total.d, total.t))} /></span>
        <b className="w-10 text-right text-sm tabular-nums">{pct(total.d, total.t)}%</b>
        {editBtn}
      </div>
      {pids.map((pid) => {
        const p = projects.find((x) => x.id === pid);
        const rows = list.filter((e) => e.projectId === pid);
        const s = sum(rows.filter((e) => (e.qty ?? 0) > 0));
        return (
          <div key={pid} className="rounded-lg bg-surface-2/40 p-2" style={{ borderLeft: `4px solid ${colorOf(projects, pid)}` }}>
            <p className="mb-1 flex items-center justify-between text-xs font-semibold"><span>{p?.name}</span><span className="tabular-nums">{s.d}/{s.t} · {pct(s.d, s.t)}%</span></p>
            <ul className="space-y-1">
              {rows.map((e) => {
                const d = done(e);
                const t = e.qty ?? 0;
                return (
                  <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_5rem_minmax(4rem,8rem)_2.5rem] items-center gap-2 text-xs">
                    <span className="truncate" title={e.desc}>{entryName(e, p)}{e.desc && <span className="text-muted"> · {e.desc}</span>}</span>
                    <span className="text-right font-semibold tabular-nums">{t ? `${d}/${t}` : d || '·'}</span>
                    <Bar value={d} max={t} tone={tone(pct(d, t))} />
                    <span className="text-right tabular-nums text-muted">{t ? `${pct(d, t)}%` : ''}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
