import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check, CheckSquare, ChevronDown, FileText, Hash, ClipboardList, Copy, Lock, Pencil, Plus, Save, Send, Trash2, X } from 'lucide-react';
import { toast } from '@/components';
import { addDays, canManage, fmtDay, previousWorkingDay, TASK_TYPES, toMinutes, weekStartOf, type Project } from '../data';
import { emptyDaily, emptyWeekly, useStore, type DayBlock, type ExtraHours, type TaskEntry, type EntryKind, type MilestoneStatus, MILESTONE_STATUS } from '../store';
import { Bar, Btn, Card, Chip, cx, fmtMin, safe } from '../ui';
import { colorOf } from './Widgets';
import { dayHhmm, DurationInput, hhmm } from './DailyViews';
import { WeekPlanner } from './Projects';

export type LogKind = 'day' | 'week';
const field = 'focus-ring w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink';
const num = 'focus-ring w-20 rounded-lg border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums text-ink';
const CUSTOM = '__custom';
/** Rows for work outside any project use projectId `other:<name>`. */
const OTHER = 'other:';
export const groupName = (pid: string, projects: Project[]) => (pid.startsWith(OTHER) ? pid.slice(OTHER.length) : projects.find((p) => p.id === pid)?.name ?? pid);
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
const STATUS_TONE: Record<MilestoneStatus, string> = { 'Not started': '', 'In progress': '!bg-sky/50 !text-sky-ink', Completed: '!bg-mint/60 !text-mint-ink', Blocked: '!bg-coral/60 !text-coral-ink' };
const KINDS: { id: EntryKind; label: string; icon: typeof Hash; tone: string }[] = [
  { id: 'number', label: 'Number', icon: Hash, tone: 'bg-sky/60 text-sky-ink' },
  { id: 'milestone', label: 'Milestone', icon: CheckSquare, tone: 'bg-mint/60 text-mint-ink' },
  { id: 'text', label: 'Text', icon: FileText, tone: 'bg-lavender/60 text-lavender-ink' },
];
/** Number, milestone or text: decides what the target and actual fields are. */
function TypeSelect({ value, onChange, disabled }: { value: EntryKind; onChange: (v: EntryKind) => void; disabled?: boolean }) {
  const k = KINDS.find((x) => x.id === value) ?? KINDS[0];
  const Icon = k.icon;
  return (
    <span className={cx('relative flex items-center gap-2 rounded-lg border border-line bg-surface py-1 pl-1 pr-2', disabled && 'border-transparent bg-transparent')}>
      <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-md', k.tone)}><Icon size={13} /></span>
      <span className="flex-1 text-sm">{k.label}</span>
      {!disabled && <ChevronDown size={14} className="text-muted" />}
      {!disabled && (
        <select aria-label="Type" className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={(e) => onChange(e.target.value as EntryKind)}>
          {KINDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      )}
    </span>
  );
}
const n = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Math.round(+v || 0)));

/** Where a log lives: the day's daily update or the week's weekly update. */
function useLog(personId: string, kind: LogKind, date: string) {
  const { daily, weekly, saveDaily, saveWeekly } = useStore();
  const key = kind === 'day' ? date : weekStartOf(date);
  const rec = kind === 'day' ? daily[`${personId}|${key}`] ?? emptyDaily() : weekly[`${personId}|${key}`] ?? emptyWeekly();
  const prevKey = kind === 'day' ? previousWorkingDay(date) : addDays(key, -7);
  const prev = (kind === 'day' ? daily[`${personId}|${prevKey}`] : weekly[`${personId}|${prevKey}`])?.entries ?? [];
  const save = (patch: { entries: TaskEntry[]; entriesAt?: string; sodAt?: string; entriesDoneAt?: string; actualsAt?: string; eodAt?: string }) => (kind === 'day' ? saveDaily(personId, key, patch) : saveWeekly(personId, key, patch));
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
  const [added, setAdded] = useState<string[]>([]);
  const [pick, setPick] = useState('');
  const [otherName, setOtherName] = useState('');
  useEffect(() => { setRows(saved); setEditing(false); setAdded([]); }, [personId, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!editing) setRows(saved); }, [rec.entries]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (readOnly || kind !== 'day') return;
    const open = () => { setEditing(true); document.getElementById('daily-update')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    window.addEventListener(EDIT_EVENT, open);
    return () => window.removeEventListener(EDIT_EVENT, open);
  }, [readOnly, kind]);
  const locked = !!rec.entriesAt && !editing;
  // Step 1 lock the targets, step 2 lock the actuals, step 3 send the end of day (or week).
  const actualsDone = rec.actualsAt ?? rec.entriesDoneAt;
  const actualsLocked = !!actualsDone && !editing;
  const ro = readOnly || actualsLocked;
  const canSend = !!rec.entriesAt && !!actualsDone && !editing && (!rec.entriesDoneAt || (rec.actualsAt ?? '') > rec.entriesDoneAt);
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
    const base = new Set(planned.keys());
    list.forEach((e) => { if (!planned.has(e.projectId)) planned.set(e.projectId, 0); });
    added.forEach((pid) => { if (!planned.has(pid)) planned.set(pid, 0); });
    return [...planned].map(([pid, min]) => ({ project: projects.find((p) => p.id === pid), pid, planned: min, name: groupName(pid, projects), extra: !base.has(pid) })).filter((g) => g.project || g.pid.startsWith(OTHER));
  }, [kind, blocks, extras, list, projects, personId, added]);
  // Projects or other work added by hand (not from the plan or your projects) can be renamed or removed.
  const [renaming, setRenaming] = useState<{ pid: string; name: string } | null>(null);
  const removeGroup = (pid: string, name: string) => {
    const has = list.some((e) => e.projectId === pid && (e.task || e.desc));
    if (has && !window.confirm(`Remove ${name} and its tasks from this ${what}?`)) return;
    setRows((r) => r.filter((e) => e.projectId !== pid));
    setAdded((a) => a.filter((x) => x !== pid));
    if (saved.some((e) => e.projectId === pid)) persist({ entries: saved.filter((e) => e.projectId !== pid) });
    toast({ title: `${name} removed`, tone: 'info' });
  };
  const renameGroup = () => {
    if (!renaming) return;
    const nm = renaming.name.trim();
    if (!nm) { toast({ title: 'Type a name', tone: 'error' }); return; }
    const to = `${OTHER}${nm}`;
    if (to !== renaming.pid && groups.some((g) => g.pid === to)) { toast({ title: `${nm} is already in the list`, tone: 'error' }); return; }
    const move = (xs: TaskEntry[]) => xs.map((e) => (e.projectId === renaming.pid ? { ...e, projectId: to } : e));
    setRows(move);
    setAdded((a) => [...a.filter((x) => x !== renaming.pid), to]);
    if (saved.some((e) => e.projectId === renaming.pid)) persist({ entries: move(saved) });
    setRenaming(null);
  };
  const addable = projects.filter((p) => p.status === 'active' && !groups.some((g) => g.pid === p.id));
  const addGroup = (v: string) => {
    if (!v) return;
    let pid = v;
    if (v === OTHER) {
      const nm = otherName.trim();
      if (!nm) { toast({ title: 'Type what the extra work was', tone: 'error' }); return; }
      pid = `${OTHER}${nm}`;
    }
    setAdded((a) => [...a, pid]);
    setEditing(true);
    setRows((r) => [...r, blank(pid)]);
    setOtherName(''); setPick('');
  };

  const upd = (id: string, p: Partial<TaskEntry>) => setRows((r) => r.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const fillFromPrev = (pid: string) => {
    const from = prev.filter((e) => e.projectId === pid);
    if (!from.length) { toast({ title: `Nothing saved for this project ${kind === 'day' ? 'on the previous day' : 'last week'}`, tone: 'info' }); return; }
    setRows((r) => [...r.filter((e) => e.projectId !== pid || e.task), ...from.map((e) => ({ ...e, id: newId(), actualMin: undefined, doneQty: undefined, status: undefined, actualText: undefined, achieved: '', remarks: '' }))]);
    toast({ title: `Copied ${from.length} task${from.length > 1 ? 's' : ''} from ${kind === 'day' ? 'the previous day' : 'last week'}`, tone: 'success' });
  };
  const save = (step: 'targets' | 'actuals') => safe(() => {
    const keep = rows.filter((e) => e.task && (e.task !== CUSTOM || e.custom?.trim()));
    if (!keep.length) throw new Error('Add at least one task before locking.');
    const at = new Date().toISOString();
    // Updating after the actuals were locked locks both again, ready to send.
    const reActuals = step === 'actuals' || !!actualsDone;
    persist({ entries: keep, ...(step === 'targets' ? { entriesAt: at, ...(kind === 'day' && !sodAt ? { sodAt: at } : {}) } : {}), ...(reActuals ? { actualsAt: at } : {}) });
    setRows(keep);
    setEditing(false);
    toast({ title: step === 'actuals' ? 'Actuals locked 🔒 You can send your end of ' + what + ' now.' : reActuals ? 'Updated and locked 🔒 Send it again when ready.' : 'Targets locked 🔒 Fill in the actuals as you go.', tone: 'success' });
  });
  const send = () => safe(() => {
    const at = new Date().toISOString();
    persist({ entries: saved, entriesDoneAt: at, ...(kind === 'day' ? { eodAt: at } : {}) });
    toast({ title: `End of ${what} sent at ${hhmm(at)} 🌙`, tone: 'success' });
  });
  const sendHint = !rec.entriesAt ? 'Lock your targets first' : !actualsDone ? 'Fill in the actuals and lock them first' : editing ? 'Finish updating first' : rec.entriesDoneAt && !canSend ? 'Already sent. Press Update to change something.' : `Send your end of ${what}`;
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
          {rec.entriesAt
            ? <span data-testid="targets-time"><Chip tone="mint"><Lock size={11} /> {kind === 'day' ? 'Targets' : 'Weekly targets'} {kind === 'day' ? hhmm(rec.entriesAt) : dayHhmm(rec.entriesAt)}</Chip></span>
            : <Chip tone="grey">Targets not locked yet</Chip>}
          {rec.entriesDoneAt
            ? <span data-testid="done-time"><Chip tone="lavender"><Send size={11} /> {kind === 'day' ? 'End of day' : 'End of week'} {kind === 'day' ? hhmm(rec.entriesDoneAt) : dayHhmm(rec.entriesDoneAt)}</Chip></span>
            : rec.entriesAt && <Chip tone="grey">{kind === 'day' ? 'End of day' : 'End of week'} not sent</Chip>}
          {!readOnly && locked && <Btn tone="ghost" className="border border-line" onClick={() => setEditing(true)}><Pencil size={13} /> Update</Btn>}
          {!readOnly && (
            <span title={sendHint} data-testid="send-eod-wrap">
              <Btn disabled={!canSend} onClick={send} data-testid="send-eod"><Send size={13} /> {rec.entriesDoneAt ? `Send end of ${what} again` : `Send end of ${what}`}</Btn>
            </span>
          )}
        </div>
      </div>

      {groups.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">{readOnly ? `Nothing for this ${what}.` : kind === 'day' ? 'Add time blocks to your plan above and a table opens here for each project.' : 'You are not on any project yet.'}</p>}

      <div className="space-y-4 p-4">
        {groups.map(({ project, pid, planned, name, extra }) => {
          const opts = optionsFor(project);
          const mine = list.filter((e) => e.projectId === pid);
          const est = mine.reduce((a, e) => a + e.estMin, 0);
          const act = mine.reduce((a, e) => a + (e.actualMin ?? 0), 0);
          const done = (e: TaskEntry) => (kind === 'week' ? weekDone(e, personId, mon, daily) : e.doneQty);
          return (
            <section key={pid} data-project-log={pid} data-kind={kind} className="overflow-hidden rounded-xl border border-line" style={{ borderLeft: `5px solid ${project ? colorOf(projects, pid) : '#64748B'}` }}>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-2/60 px-3 py-2">
                {renaming?.pid === pid ? (
                  <span className="flex items-center gap-1.5">
                    <input aria-label="New name" autoFocus className="focus-ring w-52 rounded-lg border border-line bg-surface px-2 py-1 text-sm" value={renaming.name}
                      onChange={(e) => setRenaming({ pid, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') renameGroup(); if (e.key === 'Escape') setRenaming(null); }} />
                    <Btn tone="soft" onClick={renameGroup}><Check size={13} /> Save</Btn>
                    <button aria-label="Cancel rename" className="focus-ring rounded-lg p-1 text-muted hover:text-ink" onClick={() => setRenaming(null)}><X size={14} /></button>
                  </span>
                ) : (
                  <p className="flex items-center gap-1.5 font-semibold">{name}{!project && <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted">OTHER WORK</span>}
                    {!readOnly && extra && !project && <button aria-label={`Rename ${name}`} title="Rename" className="focus-ring rounded-lg p-1 text-muted hover:bg-surface hover:text-accent-ink" onClick={() => setRenaming({ pid, name })}><Pencil size={12} /></button>}
                    {!readOnly && extra && <button aria-label={`Remove ${name}`} title="Remove" className="focus-ring rounded-lg p-1 text-muted hover:bg-surface hover:text-coral-ink" onClick={() => removeGroup(pid, name)}><Trash2 size={12} /></button>}
                  </p>
                )}
                <span className="flex flex-wrap items-center gap-2">
                  {planned > 0 && <span className="text-xs text-muted">Planned <b className="text-ink">{fmtMin(planned)}</b></span>}
                  {edit && <button className="focus-ring flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-semibold text-accent-ink hover:bg-surface-2" onClick={() => fillFromPrev(pid)}>
                    <Copy size={11} /> Fill from {kind === 'day' ? 'previous day' : 'last week'}
                  </button>}
                </span>
              </div>
              {kind === 'week' && !readOnly && project && canManage(project, personId) && (
                <details className="border-b border-line px-3 py-2">
                  <summary className="cursor-pointer text-xs font-semibold text-accent-ink">Project number targets for the week (shows on the Projects tab)</summary>
                  <div className="mt-2"><WeekPlanner p={project} date={date} /></div>
                </details>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-sm" aria-label={`${name} ${what} tasks`}>
                  <thead>
                    <tr className="bg-surface-2/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <th className="w-48 px-3 py-2">Task</th><th className="w-36 px-2 py-2">Type</th>
                      <th className="w-40 px-2 py-2">Target <span className="font-normal normal-case">({kind === 'week' ? 'this week' : 'today'})</span></th>
                      <th className="w-40 px-2 py-2">Actual <span className="font-normal normal-case">({kind === 'week' ? 'this week' : 'today'})</span></th>
                      <th className="w-28 px-2 py-2">Estimated</th><th className="w-28 px-2 py-2">Time taken</th>
                      <th className="min-w-[11rem] px-2 py-2">Notes <span className="font-normal normal-case">(optional)</span></th>{edit && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {mine.length === 0 && <tr><td colSpan={8} className="px-3 py-3 text-xs text-muted">No tasks yet.</td></tr>}
                    {mine.map((e) => {
                      const d = done(e);
                      const k = e.kind ?? 'number';
                      return (
                        <tr key={e.id} data-entry={e.id} className="border-t border-line align-middle">
                          <td className="px-3 py-2">
                            {!edit ? <span className="font-medium">{entryName(e, project)}{e.desc && <span className="block text-xs font-normal text-muted">{e.desc}</span>}</span> : <>
                              <select aria-label="Task" className={field} value={e.task} onChange={(x) => upd(e.id, { task: x.target.value })}>
                                <option value="">Pick a task</option>
                                {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                                <option value={CUSTOM}>Custom...</option>
                              </select>
                              {e.task === CUSTOM && <input aria-label="Custom task name" autoFocus className={cx(field, 'mt-1')} placeholder="Task name" value={e.custom ?? ''} onChange={(x) => upd(e.id, { custom: x.target.value })} />}
                            </>}
                          </td>
                          <td className="px-2 py-2"><TypeSelect value={k} disabled={!edit} onChange={(v) => upd(e.id, { kind: v })} /></td>
                          <td className="px-2 py-2">
                            {k === 'number'
                              ? (!edit ? <span className="tabular-nums">{e.qty ?? '·'}</span> : <input aria-label="Target" type="number" min={0} className={cx(field, 'tabular-nums')} placeholder="30" value={e.qty ?? ''} onChange={(x) => upd(e.id, { qty: n(x.target.value) })} />)
                              : (!edit ? <span>{e.targetText || '·'}</span> : <input aria-label="Target" className={field} placeholder={k === 'milestone' ? 'e.g. Prepare agenda and notes' : 'e.g. Refresh lookalike model'} value={e.targetText ?? ''} onChange={(x) => upd(e.id, { targetText: x.target.value })} />)}
                          </td>
                          <td className="px-2 py-2">
                            {k === 'number'
                              ? (ro ? <span className="tabular-nums">{d ?? '·'}</span> : <input aria-label="Actual" type="number" min={0} className={cx(field, 'tabular-nums')} placeholder={kind === 'week' && d != null ? String(d) : '0'} value={e.doneQty ?? ''} onChange={(x) => upd(e.id, { doneQty: n(x.target.value) })} />)
                              : k === 'milestone'
                                ? <select aria-label="Actual" disabled={ro} className={cx(field, 'font-medium', STATUS_TONE[e.status ?? 'Not started'])} value={e.status ?? 'Not started'} onChange={(x) => upd(e.id, { status: x.target.value as MilestoneStatus })}>
                                    {MILESTONE_STATUS.map((st) => <option key={st} value={st}>{st}</option>)}
                                  </select>
                                : (ro ? <span>{e.actualText || '·'}</span> : <input aria-label="Actual" className={field} placeholder="What got done" value={e.actualText ?? ''} onChange={(x) => upd(e.id, { actualText: x.target.value })} />)}
                          </td>
                          <td className="px-2 py-2">{!edit ? <span className="tabular-nums">{fmtMin(e.estMin)}</span>
                            : <DurationInput label="Estimated time" placeholder="1h" value={e.estMin || undefined} onChange={(m) => upd(e.id, { estMin: m ?? 0 })} />}</td>
                          <td className="px-2 py-2">{ro ? <span className="tabular-nums">{e.actualMin != null ? fmtMin(e.actualMin) : '·'}</span>
                            : <DurationInput label="Actual time" placeholder="..." value={e.actualMin} onChange={(m) => upd(e.id, { actualMin: m ?? undefined })} />}</td>
                          <td className="px-2 py-2">{ro ? <span>{e.remarks || '·'}</span>
                            : <input aria-label="Notes" className={field} placeholder="Add note..." value={e.remarks} onChange={(x) => upd(e.id, { remarks: x.target.value })} />}</td>
                          {edit && <td className="py-2"><button aria-label="Remove task" className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => setRows((r) => r.filter((y) => y.id !== e.id))}><Trash2 size={14} /></button></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-surface-2/40 text-xs font-semibold">
                      <td className="px-2 py-2">{edit && <button className="focus-ring flex items-center gap-1 rounded-full border border-line px-3 py-1 text-accent-ink hover:bg-surface-2" onClick={() => setRows((r) => [...r, blank(pid)])}><Plus size={12} /> Add task</button>}</td>
                      <td className="px-2 py-2 text-right text-muted" colSpan={3}>Total</td>
                      <td className="px-2 py-2 tabular-nums" data-testid="est-total">{fmtMin(est)}{planned > 0 && est > planned && <span className="ml-1 text-coral-ink">over plan</span>}</td>
                      <td className="px-2 py-2 tabular-nums" data-testid="act-total">{fmtMin(act)}</td><td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          );
        })}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3" aria-label="Add a project">
          <span className="text-sm font-semibold">Worked on something else?</span>
          <select aria-label="Add project" className="focus-ring rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink" value={pick} onChange={(e) => { setPick(e.target.value); if (e.target.value !== OTHER) addGroup(e.target.value); }}>
            <option value="">Add a project...</option>
            {addable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value={OTHER}>Other work (not a project)...</option>
          </select>
          {pick === OTHER && <>
            <input aria-label="Other work name" autoFocus className="focus-ring w-56 rounded-lg border border-line bg-surface px-2 py-1 text-sm" placeholder="e.g. Hiring, internal training" value={otherName} onChange={(e) => setOtherName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGroup(OTHER)} />
            <Btn tone="soft" onClick={() => addGroup(OTHER)}><Plus size={13} /> Add</Btn>
          </>}
        </div>
      )}

      {groups.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t border-line px-4 py-3">
          <p className="text-sm">{kind === 'day' ? 'Day' : 'Week'} total: planned <b>{fmtMin(plannedAll)}</b> · estimated <b data-testid={`${kind}-est`}>{fmtMin(all.est)}</b> · actual <b data-testid={`${kind}-act`}>{fmtMin(all.act)}</b></p>
          {!readOnly && (
            <span className="ml-auto flex gap-2">
              {!locked
                ? <Btn onClick={() => save('targets')}><Lock size={13} /> {rec.entriesAt ? 'Update and lock' : 'Lock targets'}</Btn>
                : !actualsLocked
                  ? <Btn onClick={() => save('actuals')}><Save size={13} /> Lock actuals</Btn>
                  : <span className="text-xs text-muted">{rec.entriesDoneAt && !canSend ? 'Sent. Press Update at the top to change anything.' : 'Targets and actuals locked. Send it from the top.'}</span>}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

/** Targets against what got achieved (e.g. 233/322 with a percent bar), per task and per project, filled automatically. */
export function TargetsProgress({ personId, date, kind, editable }: { personId: string; date: string; kind: LogKind; editable?: boolean }) {
  const { projects, daily, weekly, saveWeekly } = useStore();
  const mon = weekStartOf(date);
  const list = kind === 'day' ? daily[`${personId}|${date}`]?.entries ?? [] : mergeWeek(personId, mon, daily, weekly[`${personId}|${mon}`]?.entries ?? [], weekly[`${personId}|${mon}`]?.overrides);
  const setNum = (e: TaskEntry, patch: { qty?: number; doneQty?: number; status?: MilestoneStatus; actualText?: string }) => {
    const rec = weekly[`${personId}|${mon}`];
    const k = mergeKey(e);
    saveWeekly(personId, mon, { overrides: { ...rec?.overrides, [k]: { ...rec?.overrides?.[k], qty: e.qty, doneQty: e.doneQty, ...patch } } });
  };
  const done = (e: TaskEntry) => ((e.kind ?? 'number') === 'milestone' ? (e.status === 'Completed' ? 1 : 0) : (e.kind ?? 'number') === 'text' ? 0 : e.doneQty ?? 0);
  const tgt = (e: TaskEntry) => ((e.kind ?? 'number') === 'milestone' ? 1 : (e.kind ?? 'number') === 'text' ? 0 : e.qty ?? 0);
  const counted = list.filter((e) => tgt(e) > 0);
  const pids = [...new Set(list.map((e) => e.projectId))];
  const sum = (xs: TaskEntry[]) => xs.reduce((a, e) => ({ t: a.t + tgt(e), d: a.d + Math.min(done(e), tgt(e)) }), { t: 0, d: 0 });
  const total = sum(counted);
  const pct = (d: number, t: number) => (t ? Math.round((d / t) * 100) : 0);
  const tone = (p: number) => (p >= 100 ? 'mint' : p >= 60 ? 'sky' : 'peach');
  const editBtn = <button type="button" className="focus-ring flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-accent-ink hover:bg-surface-2"
    onClick={() => (kind === 'day' ? editDayTasks() : window.dispatchEvent(new Event(WEEK_EDIT_EVENT)))}><Pencil size={11} /> Edit</button>;

  if (!list.length) return <div className="flex items-center justify-between rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted" data-progress={kind}>{kind === 'day' ? 'No daily tasks entered yet.' : 'Nothing yet this week. Tasks from your daily updates add up here.'}{editBtn}</div>;
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
        const gname = groupName(pid, projects);
        const s = sum(rows.filter((e) => tgt(e) > 0));
        return (
          <div key={pid} className="rounded-lg bg-surface-2/40 p-2" style={{ borderLeft: `4px solid ${p ? colorOf(projects, pid) : '#64748B'}` }}>
            <p className="mb-1 flex items-center justify-between text-xs font-semibold"><span>{gname}</span><span className="tabular-nums">{s.d}/{s.t} · {pct(s.d, s.t)}%</span></p>
            <ul className="space-y-1">
              {rows.map((e) => {
                const d = done(e);
                const t = tgt(e);
                return (
                  <li key={e.id} className={cx('grid items-center gap-2 text-xs', editable ? 'grid-cols-[minmax(0,1fr)_8.5rem_minmax(4rem,8rem)_2.5rem]' : 'grid-cols-[minmax(0,1fr)_5rem_minmax(4rem,8rem)_2.5rem]')}>
                    <span className="truncate" title={e.desc}>{entryName(e, p)}{e.desc && <span className="text-muted"> · {e.desc}</span>}</span>
                    {editable && e.kind === 'milestone' ? (
                      <select aria-label={`${entryName(e, p)} status`} className="focus-ring rounded-md border border-line bg-surface px-1 py-0.5 text-xs font-semibold" value={e.status ?? 'Not started'} onChange={(x) => setNum(e, { status: x.target.value as MilestoneStatus })}>
                        {MILESTONE_STATUS.map((st) => <option key={st}>{st}</option>)}
                      </select>
                    ) : editable && e.kind === 'text' ? (
                      <TextCell label={`${entryName(e, p)} actual`} value={e.actualText ?? ''} onSave={(v) => setNum(e, { actualText: v })} />
                    ) : editable && (e.kind ?? 'number') === 'number' ? (
                      <span className="flex items-center justify-end gap-0.5" data-edit-row={e.id}>
                        <NumCell label={`${entryName(e, p)} achieved`} value={e.doneQty ?? 0} onSave={(v) => setNum(e, { doneQty: v })} />
                        <span className="text-muted">/</span>
                        <NumCell label={`${entryName(e, p)} target`} value={e.qty ?? 0} onSave={(v) => setNum(e, { qty: v })} />
                      </span>
                    ) : (
                      <span className="text-right font-semibold tabular-nums">{e.kind === 'milestone' ? (e.status ?? 'Not started') : e.kind === 'text' ? (e.actualText || '·') : t ? `${d}/${t}` : d || '·'}</span>
                    )}
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

const WEEK_EDIT_EVENT = 'ls-edit-week';

/**
 * The week, merged from every daily update (plus anything added by hand for the week):
 * the same task on several days is one row with the numbers added up.
 */
export const mergeKey = (e: TaskEntry) => `${e.projectId}|${e.task}|${(e.custom ?? '').trim().toLowerCase()}|${e.kind ?? 'number'}`;
export function mergeWeek(personId: string, mon: string, daily: ReturnType<typeof useStore.getState>['daily'], extra: TaskEntry[] = [], overrides: Record<string, { qty?: number; doneQty?: number; status?: MilestoneStatus; actualText?: string; targetText?: string }> = {}): TaskEntry[] {
  const rows = [...[0, 1, 2, 3, 4].flatMap((i) => daily[`${personId}|${addDays(mon, i)}`]?.entries ?? []), ...extra];
  const out = new Map<string, TaskEntry>();
  rows.forEach((e) => {
    const k = mergeKey(e);
    const m = out.get(k);
    if (!m) { out.set(k, { ...e, id: `wk-${k}`, remarks: e.remarks ?? '' }); return; }
    m.qty = e.qty != null || m.qty != null ? (m.qty ?? 0) + (e.qty ?? 0) : undefined;
    m.doneQty = e.doneQty != null || m.doneQty != null ? (m.doneQty ?? 0) + (e.doneQty ?? 0) : undefined;
    m.estMin += e.estMin;
    m.actualMin = e.actualMin != null || m.actualMin != null ? (m.actualMin ?? 0) + (e.actualMin ?? 0) : undefined;
    if (e.targetText) m.targetText = e.targetText;
    if (e.actualText) m.actualText = e.actualText;
    if (e.status) m.status = e.status;
    if (!m.desc && e.desc) m.desc = e.desc;
    if (e.remarks && !m.remarks.includes(e.remarks)) m.remarks = m.remarks ? `${m.remarks}; ${e.remarks}` : e.remarks;
  });
  // Numbers corrected by hand on the weekly view win over the added-up ones.
  out.forEach((m, k) => {
    const o = overrides[k];
    if (o?.qty != null) m.qty = o.qty;
    if (o?.doneQty != null) m.doneQty = o.doneQty;
    if (o?.status) m.status = o.status;
    if (o?.actualText != null) m.actualText = o.actualText;
  });
  return [...out.values()];
}

/** Weekly update, filled automatically from the daily updates. Submit the end of week here; Edit adds anything else for the week. */
export function WeeklyAuto({ personId, date, readOnly }: { personId: string; date: string; readOnly?: boolean }) {
  const { daily, weekly, saveWeekly } = useStore();
  const mon = weekStartOf(date);
  const rec = weekly[`${personId}|${mon}`];
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEditing(false); }, [personId, mon]);
  useEffect(() => {
    if (readOnly) return;
    const open = () => { setEditing(true); setTimeout(() => document.getElementById('weekly-update')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };
    window.addEventListener(WEEK_EDIT_EVENT, open);
    return () => window.removeEventListener(WEEK_EDIT_EVENT, open);
  }, [readOnly]);
  const merged = mergeWeek(personId, mon, daily, rec?.entries ?? []);
  const est = merged.reduce((a, e) => a + e.estMin, 0);
  const act = merged.reduce((a, e) => a + (e.actualMin ?? 0), 0);
  const submit = () => safe(() => {
    const at = new Date().toISOString();
    saveWeekly(personId, mon, { entries: rec?.entries ?? [], entriesDoneAt: at, eowAt: at, ...(rec?.targetsAt ? {} : { targetsAt: at }) });
    setEditing(false);
    toast({ title: `End of week submitted at ${hhmm(at)} 🎉`, tone: 'success' });
  });
  return (
    <Card className="!p-0" >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold"><CalendarRange size={17} className="text-accent-ink" />Weekly update</h2>
          <p className="text-xs text-muted">{fmtDay(mon)} to {fmtDay(addDays(mon, 4))} · fills in from your daily updates. The same task on different days adds up in one row.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Estimated <b className="text-ink">{fmtMin(est)}</b> · taken <b className="text-ink">{fmtMin(act)}</b></span>
          {rec?.entriesDoneAt
            ? <span data-testid="week-done-time"><Chip tone="lavender"><Send size={11} /> End of week {dayHhmm(rec.entriesDoneAt)}</Chip></span>
            : <Chip tone="grey">End of week not sent</Chip>}
          {!readOnly && <Btn tone="ghost" className="border border-line" onClick={() => setEditing((v) => !v)}><Pencil size={13} /> {editing ? 'Close edit' : 'Edit'}</Btn>}
          {!readOnly && <Btn onClick={submit}><Send size={13} /> {rec?.entriesDoneAt ? 'Submit again' : 'Submit end of week'}</Btn>}
        </div>
      </div>
      <div className="space-y-3 p-4">
        {editing && !readOnly && <WeekAddRow personId={personId} mon={mon} />}
        <TargetsProgress personId={personId} date={date} kind="week" editable={editing && !readOnly} />
      </div>
    </Card>
  );
}

/** A number you can click and change; saves when you leave the field or press Enter. */
function NumCell({ value, onSave, label }: { value: number; onSave: (v: number) => void; label: string }) {
  const [v, setV] = useState(String(value));
  useEffect(() => { setV(String(value)); }, [value]);
  const commit = () => { const x = Math.max(0, Math.round(+v || 0)); if (x !== value) onSave(x); else setV(String(value)); };
  return (
    <input aria-label={label} type="number" min={0} inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="focus-ring w-14 rounded-md border border-line bg-surface px-1.5 py-0.5 text-right text-xs font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
  );
}

/** Text you can click and change; saves when you leave the field or press Enter. */
function TextCell({ value, onSave, label }: { value: string; onSave: (v: string) => void; label: string }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  return (
    <input aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder="What got done" className="focus-ring w-full rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs" />
  );
}

/** One simple row to add something to the week: project, task, target and achieved, then Add. Same task adds to its row. */
function WeekAddRow({ personId, mon }: { personId: string; mon: string }) {
  const { projects, weekly, saveWeekly } = useStore();
  const mine = projects.filter((p) => p.status === 'active' && (p.pmId === personId || p.teamIds.includes(personId) || p.admins?.includes(personId)));
  const list = mine.length ? mine : projects.filter((p) => p.status === 'active');
  const [pid, setPid] = useState(list[0]?.id ?? '');
  const [task, setTask] = useState('');
  const [custom, setCustom] = useState('');
  const [qty, setQty] = useState('');
  const [done, setDone] = useState('');
  const [type, setType] = useState<EntryKind>('number');
  const [tText, setTText] = useState('');
  const [aText, setAText] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('Not started');
  const opts = optionsFor(projects.find((p) => p.id === pid));
  const field = 'focus-ring rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink';
  const add = () => {
    if (!task) { toast({ title: 'Pick a task', tone: 'error' }); return; }
    if (task === CUSTOM && !custom.trim()) { toast({ title: 'Type the task name', tone: 'error' }); return; }
    const rec = weekly[`${personId}|${mon}`];
    const base = { id: newId(), projectId: pid, task, custom: task === CUSTOM ? custom.trim() : undefined, desc: '', estMin: 0, achieved: '', remarks: '', kind: type };
    const e: TaskEntry = type === 'number'
      ? { ...base, qty: qty ? Math.max(0, Math.round(+qty)) : undefined, doneQty: done ? Math.max(0, Math.round(+done)) : undefined }
      : type === 'milestone' ? { ...base, targetText: tText.trim(), status } : { ...base, targetText: tText.trim(), actualText: aText.trim() };
    // If that row's numbers were corrected by hand, add on top of the corrected numbers.
    const k = mergeKey(e);
    const o = rec?.overrides?.[k];
    const overrides = o ? { ...rec!.overrides, [k]: { qty: o.qty != null ? o.qty + (e.qty ?? 0) : undefined, doneQty: o.doneQty != null ? o.doneQty + (e.doneQty ?? 0) : undefined } } : rec?.overrides;
    saveWeekly(personId, mon, { entries: [...(rec?.entries ?? []), e], overrides });
    setQty(''); setDone(''); setCustom(''); setTText(''); setAText(''); setStatus('Not started');
    toast({ title: 'Added to the week', tone: 'success' });
  };
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-accent/40 bg-accent-soft/30 p-3" aria-label="Add to the week">
      <label className="text-xs font-semibold text-muted">Project
        <select aria-label="Week project" className={cx(field, 'mt-1 block w-48')} value={pid} onChange={(e) => setPid(e.target.value)}>
          {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold text-muted">Task
        <select aria-label="Week task" className={cx(field, 'mt-1 block w-48')} value={task} onChange={(e) => setTask(e.target.value)}>
          <option value="">Pick a task</option>
          {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          <option value={CUSTOM}>Custom...</option>
        </select>
      </label>
      {task === CUSTOM && <label className="text-xs font-semibold text-muted">Name<input aria-label="Week custom task" autoFocus className={cx(field, 'mt-1 block w-40')} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Task name" /></label>}
      <label className="text-xs font-semibold text-muted">Type
        <select aria-label="Week type" className={cx(field, 'mt-1 block w-32')} value={type} onChange={(e) => setType(e.target.value as EntryKind)}>
          <option value="number"># Number</option><option value="milestone">☑ Milestone</option><option value="text">✎ Text</option>
        </select>
      </label>
      {type === 'number' ? <>
        <label className="text-xs font-semibold text-muted">Target<input aria-label="Week target" type="number" min={0} className={cx(field, 'mt-1 block w-20 text-right')} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></label>
        <label className="text-xs font-semibold text-muted">Achieved<input aria-label="Week achieved" type="number" min={0} className={cx(field, 'mt-1 block w-20 text-right')} value={done} onChange={(e) => setDone(e.target.value)} placeholder="0" onKeyDown={(e) => e.key === 'Enter' && add()} /></label>
      </> : <>
        <label className="text-xs font-semibold text-muted">Target<input aria-label="Week target text" className={cx(field, 'mt-1 block w-48')} value={tText} onChange={(e) => setTText(e.target.value)} placeholder={type === 'milestone' ? 'e.g. Proposal signed' : 'e.g. Refresh the model'} /></label>
        {type === 'milestone'
          ? <label className="text-xs font-semibold text-muted">Status<select aria-label="Week status" className={cx(field, 'mt-1 block w-36')} value={status} onChange={(e) => setStatus(e.target.value as MilestoneStatus)}>{MILESTONE_STATUS.map((st) => <option key={st}>{st}</option>)}</select></label>
          : <label className="text-xs font-semibold text-muted">Actual<input aria-label="Week actual text" className={cx(field, 'mt-1 block w-48')} value={aText} onChange={(e) => setAText(e.target.value)} placeholder="What got done" onKeyDown={(e) => e.key === 'Enter' && add()} /></label>}
      </>}
      <Btn onClick={add}><Plus size={14} /> Add</Btn>
      <p className="w-full text-[11px] text-muted">Click any number below to change it.</p>
    </div>
  );
}
