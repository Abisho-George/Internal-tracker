import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, Check, CheckSquare, ChevronDown, FileText, Hash, ClipboardList, Copy, Lock, Pencil, Plus, Save, Send, Settings2, Trash2, X } from 'lucide-react';
import { Modal, toast } from '@/components';
import { addDays, canManage, fmtDay, previousWorkingDay, typesFor, TASK_TYPES, toMinutes, weekStartOf, type Project } from '../data';
import { emptyDaily, emptyWeekly, useStore, type DayBlock, type ExtraHours, type TaskEntry, type EntryKind, type MilestoneStatus, MILESTONE_STATUS } from '../store';
import { Bar, Btn, Card, Chip, cx, fmtMin, safe } from '../ui';
import { colorOf } from './Widgets';
import { dayHhmm, DurationInput, hhmm } from './DailyViews';
import { WeekPlanner } from './Projects';

export type LogKind = 'day' | 'week';
const field = 'focus-ring w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink';
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
export const entryName = (e: TaskEntry, p?: Project) => (e.task === CUSTOM ? e.custom || 'Custom task' : e.task.startsWith(MY) ? e.task.slice(MY.length) : optionsFor(p).find((o) => o.id === e.task)?.name ?? e.task);
/** Options a person picks from in the daily update: the project's task types (minus ones the project removed), their own extras, minus what they hid. */
const MY = 'my:';
export function menuFor(p: Project | undefined, menu?: { hidden: string[]; extra: string[]; removed?: string[] }) {
  const base = [...typesFor(p).map((t) => ({ id: t.id, name: t.name })), ...(p?.customStandards ?? []).map((c) => ({ id: `std:${c.id}`, name: c.name }))];
  const mine = (menu?.extra ?? []).map((n) => ({ id: `${MY}${n}`, name: n }));
  return [...base, ...mine].filter((o) => !menu?.hidden.includes(o.id) && !menu?.removed?.includes(o.id));
}
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
  const { projects, daily, profiles } = useStore();
  const myMenu = profiles[personId]?.taskMenu;
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (!nm) { toast({ title: 'Type a name', tone: 'info' }); return; }
    const to = `${OTHER}${nm}`;
    if (to !== renaming.pid && groups.some((g) => g.pid === to)) { toast({ title: `${nm} is already in the list`, tone: 'info' }); return; }
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
      if (!nm) { toast({ title: 'Type what the extra work was', tone: 'info' }); return; }
      pid = `${OTHER}${nm}`;
    }
    setAdded((a) => [...a, pid]);
    setEditing(true);
    setRows((r) => [...r, blank(pid)]);
    setOtherName(''); setPick('');
  };

  const upd = (id: string, p: Partial<TaskEntry>) => setRows((r) => r.map((e) => (e.id === id ? { ...e, ...p } : e)));
  // Estimated time fills itself from the project's block: what's left after the times typed by hand, shared by the rest.
  useEffect(() => {
    if (kind !== 'day' || !edit) return;
    const next = rows.map((e) => ({ ...e }));
    groups.forEach(({ pid, planned }) => {
      if (!planned) return;
      const mine = next.filter((e) => e.projectId === pid);
      const auto = mine.filter((e) => !e.estManual);
      if (!auto.length) return;
      const left = Math.max(0, planned - mine.filter((e) => e.estManual).reduce((a, e) => a + e.estMin, 0));
      const each = Math.floor(left / auto.length / 5) * 5;
      auto.forEach((e, i) => { e.estMin = i === auto.length - 1 ? left - each * (auto.length - 1) : each; });
    });
    if (next.some((e, i) => e.estMin !== rows[i].estMin)) setRows(next);
  }, [rows, groups, kind, edit]); // eslint-disable-line react-hooks/exhaustive-deps
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
          {!readOnly && <button aria-label="Task list settings" title="Choose what shows in the task dropdown" data-testid="task-menu-settings" className="focus-ring rounded-lg border border-line p-1.5 text-muted hover:bg-surface-2 hover:text-ink" onClick={() => setMenuOpen(true)}><Settings2 size={15} /></button>}
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
          const opts = menuFor(project, myMenu);
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
                            {(e.taskId || e.carried) && (
                              <span className="mb-1 flex flex-wrap gap-1">
                                {e.carried ? <span className="rounded bg-butter px-1.5 py-px text-[10px] font-bold text-butter-ink">From yesterday's tasks</span> : <span className="rounded bg-sky px-1.5 py-px text-[10px] font-bold text-sky-ink">Assigned</span>}
                              </span>
                            )}
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
                              ? (e.taskId ? <span className="tabular-nums" title="Fills in with the approved number">{e.doneQty ?? 0}<span className="ml-1 text-[10px] text-muted">{e.doneQty == null ? 'awaiting approval' : 'approved'}</span></span>
                                : ro ? <span className="tabular-nums">{d ?? '·'}</span> : <input aria-label="Actual" type="number" min={0} className={cx(field, 'tabular-nums')} placeholder={kind === 'week' && d != null ? String(d) : '0'} value={e.doneQty ?? ''} onChange={(x) => upd(e.id, { doneQty: n(x.target.value) })} />)
                              : k === 'milestone'
                                ? <select aria-label="Actual" disabled={ro} className={cx(field, 'font-medium', STATUS_TONE[e.status ?? 'Not started'])} value={e.status ?? 'Not started'} onChange={(x) => upd(e.id, { status: x.target.value as MilestoneStatus })}>
                                    {MILESTONE_STATUS.map((st) => <option key={st} value={st}>{st}</option>)}
                                  </select>
                                : (ro ? <span>{e.actualText || '·'}</span> : <input aria-label="Actual" className={field} placeholder="What got done" value={e.actualText ?? ''} onChange={(x) => upd(e.id, { actualText: x.target.value })} />)}
                          </td>
                          <td className="px-2 py-2">{!edit ? <span className="tabular-nums">{fmtMin(e.estMin)}</span>
                            : <DurationInput label="Estimated time" placeholder="1h" value={e.estMin || undefined} onChange={(m) => upd(e.id, { estMin: m ?? 0, estManual: m != null })} />}</td>
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
      {!readOnly && <TaskMenuSettings personId={personId} open={menuOpen} onClose={() => setMenuOpen(false)} />}
    </Card>
  );
}

/** Settings for the daily update's task dropdown: hide options you don't use and add your own. */
function TaskMenuSettings({ personId, open, onClose }: { personId: string; open: boolean; onClose: () => void }) {
  const { profiles, setProfile } = useStore();
  const menu = { hidden: [] as string[], extra: [] as string[], removed: [] as string[], ...profiles[personId]?.taskMenu };
  const [name, setName] = useState('');
  const save = (m: Partial<typeof menu>) => setProfile(personId, { taskMenu: { ...menu, ...m } });
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const toggle = (id: string) => save({ ...menu, hidden: menu.hidden.includes(id) ? menu.hidden.filter((x) => x !== id) : [...menu.hidden, id] });
  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (menu.extra.some((x) => x.toLowerCase() === n.toLowerCase()) || TASK_TYPES.some((t) => t.name.toLowerCase() === n.toLowerCase())) { toast({ title: `"${n}" is already in the list`, tone: 'info' }); return; }
    save({ ...menu, extra: [...menu.extra, n] });
    setName('');
  };
  const row = (id: string, label: string, mine: boolean) => (
    <li key={id} className="flex items-center gap-2 py-1.5 text-sm">
      <input type="checkbox" aria-label={`Show ${label}`} className="h-4 w-4" checked={!menu.hidden.includes(id)} onChange={() => toggle(id)} />
      <span className={cx('flex-1', menu.hidden.includes(id) && 'text-muted line-through')}>{label}</span>
      {confirmDel === id ? (
        <span className="flex items-center gap-1 text-xs"><span className="font-semibold text-coral-ink">Delete?</span>
          <button className="rounded px-1.5 py-0.5 text-muted hover:bg-surface-2" onClick={() => setConfirmDel(null)}>No</button>
          <button className="rounded bg-coral-strong px-1.5 py-0.5 font-semibold text-white" onClick={() => {
            setConfirmDel(null);
            if (mine) save({ hidden: menu.hidden.filter((x) => x !== id), extra: menu.extra.filter((x) => x !== label) });
            else save({ hidden: menu.hidden.filter((x) => x !== id), removed: [...menu.removed, id] });
            toast({ title: `${label} deleted from your list`, tone: 'info' });
          }}>Yes</button>
        </span>
      ) : <button aria-label={`Delete ${label}`} title="Delete from the list" className="rounded p-1 text-muted hover:text-coral-ink" onClick={() => setConfirmDel(id)}><Trash2 size={13} /></button>}
    </li>
  );
  return (
    <Modal open={open} onClose={onClose} title="Task dropdown" description="Choose what shows when you add a task. Project tasks always show." size="sm" footer={<Btn onClick={onClose}>Done</Btn>}>
      <div data-testid="task-menu">
        <ul className="divide-y divide-line">
          {TASK_TYPES.filter((t) => !menu.removed.includes(t.id)).map((t) => row(t.id, t.name, false))}
          {menu.extra.map((n) => row(`${MY}${n}`, n, true))}
        </ul>
        {menu.removed.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs" data-testid="menu-removed">
            <span className="text-muted">Deleted:</span>
            {menu.removed.map((id) => {
              const t = TASK_TYPES.find((x) => x.id === id);
              return t ? <button key={id} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 font-semibold text-accent-ink hover:bg-surface-2" onClick={() => save({ removed: menu.removed.filter((x) => x !== id) })}><Plus size={11} /> {t.name}</button> : null;
            })}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input aria-label="New task option" className="focus-ring flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm" placeholder="Add your own, e.g. Client call" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <Btn tone="soft" onClick={add}><Plus size={13} /> Add</Btn>
        </div>
      </div>
    </Modal>
  );
}

/** Targets against what got achieved (e.g. 233/322 with a percent bar), per task and per project, filled automatically. */
export function TargetsProgress({ personId, date, kind, editable }: { personId: string; date: string; kind: LogKind; editable?: boolean }) {
  const { projects, daily, weekly, saveWeekly, profiles, setProfile } = useStore();
  const headColor = profiles[personId]?.sheetColors?.[kind] ?? profiles[personId]?.sheetColor ?? '#7B1A48';
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
        {!editable && (
          <label className="flex cursor-pointer items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs font-semibold text-muted hover:bg-surface-2" title="Table header colour">
            <span className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: headColor }} />Header
            <input type="color" aria-label="Table header colour" className="sr-only" value={headColor} onChange={(x) => setProfile(personId, { sheetColors: { ...profiles[personId]?.sheetColors, [kind]: x.target.value } })} />
          </label>
        )}
        {editBtn}
      </div>
      {!editable && (() => {
        const dateLabel = kind === 'day' ? fmtDay(date) : `${fmtDay(mon)} to ${fmtDay(addDays(mon, 4))}`;
        const th = 'border border-white/20 px-3 py-2 text-center text-xs font-bold';
        const totalRows = list.length;
        return (
          <div className="overflow-x-auto" data-testid={`sheet-${kind}`}>
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead><tr className="text-white" style={{ background: headColor }}>
                <th className={th}>Date</th><th className={th}>Project</th><th className={cx(th, 'w-[32%]')}>Targets</th><th className={th}>Estimated time</th>
                <th className={cx(th, 'w-[32%]')}>Targets achieved</th><th className={th}>Actual time taken</th>
              </tr></thead>
              <tbody>
                {pids.flatMap((pid, pi) => {
                  const p = projects.find((x) => x.id === pid);
                  const rows = list.filter((e) => e.projectId === pid);
                  const shade = pi % 2 ? 'bg-surface-2/50' : 'bg-surface';
                  return rows.map((e, ri) => {
                    const k = e.kind ?? 'number';
                    const n = entryName(e, p);
                    const target = k === 'number' ? `${e.qty ? `${e.qty} ` : ''}${n}${e.desc && !e.desc.toLowerCase().includes(n.toLowerCase()) ? ` (${e.desc})` : ''}` : e.targetText || n;
                    const d = done(e);
                    const got = k === 'text' ? e.actualText : k === 'milestone' ? (e.status && e.status !== 'Not started' ? e.status : '') : d ? `${d}${e.qty ? ` of ${e.qty}` : ''} ${n}` : '';
                    const first = ri === 0;
                    const td = cx('border-x border-line px-3 py-2 align-middle', first ? (pi ? 'border-t-[3px]' : 'border-t border-t-line') : 'border-t border-t-line/60');
                    return (
                      <tr key={e.id} className={shade} data-sheet-project={first ? pid : undefined} style={first && pi ? { borderTop: `3px solid ${headColor}99` } : undefined}>
                        {pi === 0 && first && <td rowSpan={totalRows} className="whitespace-nowrap border border-line bg-surface px-3 py-2 text-center align-middle font-medium">{dateLabel}</td>}
                        {first && <td rowSpan={rows.length} className={cx(td, 'text-center font-semibold')} style={{ borderLeft: `4px solid ${p ? colorOf(projects, pid) : '#64748B'}` }}>{groupName(pid, projects)}</td>}
                        <td className={td}>{target}</td>
                        <td className={cx(td, 'whitespace-nowrap text-center tabular-nums')}>{e.estMin ? fmtMin(e.estMin) : '·'}</td>
                        <td className={td}>{got || <span className="text-xs text-muted">Not updated yet</span>}</td>
                        <td className={cx(td, 'whitespace-nowrap text-center tabular-nums')}>{e.actualMin ? fmtMin(e.actualMin) : '·'}</td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        );
      })()}
      {editable && pids.map((pid) => {
        const p = projects.find((x) => x.id === pid);
        const rows = list.filter((e) => e.projectId === pid);
        const gname = groupName(pid, projects);
        const s = sum(rows.filter((e) => tgt(e) > 0));
        return (
          <div key={pid} className="rounded-lg bg-surface-2/40 px-3 py-2" style={{ borderLeft: `4px solid ${p ? colorOf(projects, pid) : '#64748B'}` }}>
            <p className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold"><span>{gname}</span>
              <span className="text-xs font-semibold tabular-nums text-muted">{s.t ? `${s.d}/${s.t} · ${pct(s.d, s.t)}%` : `${rows.length} task${rows.length === 1 ? '' : 's'}`}</span></p>
            <ul className="divide-y divide-line/70">
              {rows.map((e) => {
                const d = done(e);
                const t = tgt(e);
                const k = e.kind ?? 'number';
                const name = entryName(e, p);
                const sub = k === 'number' ? e.desc : e.targetText || e.desc;
                const stTone = e.status === 'Completed' ? 'mint' : e.status === 'Blocked' ? 'coral' : e.status === 'In progress' ? 'sky' : 'grey';
                return (
                  <li key={e.id} className="py-2 text-sm" data-progress-row={e.id}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="min-w-[10rem] flex-1 font-medium">{name}</span>
                      {editable && k === 'milestone' ? (
                        <select aria-label={`${name} status`} className="focus-ring rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs font-semibold" value={e.status ?? 'Not started'} onChange={(x) => setNum(e, { status: x.target.value as MilestoneStatus })}>
                          {MILESTONE_STATUS.map((st) => <option key={st}>{st}</option>)}
                        </select>
                      ) : editable && k === 'number' ? (
                        <span className="flex items-center gap-0.5" data-edit-row={e.id}>
                          <NumCell label={`${name} achieved`} value={e.doneQty ?? 0} onSave={(v) => setNum(e, { doneQty: v })} />
                          <span className="text-muted">/</span>
                          <NumCell label={`${name} target`} value={e.qty ?? 0} onSave={(v) => setNum(e, { qty: v })} />
                        </span>
                      ) : k === 'milestone' ? <Chip tone={stTone}>{e.status ?? 'Not started'}</Chip>
                        : k === 'number' ? (
                          <span className="flex w-full items-center gap-2 sm:w-64">
                            <b className="w-16 shrink-0 text-right tabular-nums">{t ? `${d}/${t}` : d || 0}</b>
                            <span className="flex-1"><Bar value={d} max={t} tone={tone(pct(d, t))} /></span>
                            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">{t ? `${pct(d, t)}%` : ''}</span>
                          </span>
                        ) : <Chip tone="lavender">Text</Chip>}
                    </div>
                    {k === 'text' ? (
                      <div className="mt-1 grid gap-0.5 text-xs">
                        {sub && <p><span className="font-semibold text-muted">Target: </span>{sub}</p>}
                        {editable ? <TextCell label={`${name} actual`} value={e.actualText ?? ''} onSave={(v) => setNum(e, { actualText: v })} />
                          : <p><span className="font-semibold text-muted">Done: </span>{e.actualText || <span className="text-muted">Not updated yet</span>}</p>}
                      </div>
                    ) : sub ? <p className="mt-0.5 text-xs text-muted">{sub}</p> : null}
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
  const all = [...[0, 1, 2, 3, 4].flatMap((i) => daily[`${personId}|${addDays(mon, i)}`]?.entries ?? []), ...extra];
  // A task carried over to the next day is the same work: count only its latest row.
  const lastFor = new Map<string, number>();
  all.forEach((e, i) => { if (e.taskId) lastFor.set(e.taskId, i); });
  const rows = all.filter((e, i) => !e.taskId || lastFor.get(e.taskId) === i);
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
  const { projects, weekly, saveWeekly, profiles } = useStore();
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
  const opts = menuFor(projects.find((p) => p.id === pid), profiles[personId]?.taskMenu);
  const field = 'focus-ring rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink';
  const add = () => {
    if (!task) { toast({ title: 'Pick a task', tone: 'info' }); return; }
    if (task === CUSTOM && !custom.trim()) { toast({ title: 'Type the task name', tone: 'info' }); return; }
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

/** Weekly hours: where the week's time went, day by day and project by project, filled in from the day plans. Read-only. */
export function WeeklyHours({ personId, date }: { personId: string; date: string }) {
  const { daily, projects } = useStore();
  const mon = weekStartOf(date);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
  const WDN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDay = days.map((d) => {
    const rec = daily[`${personId}|${d}`];
    let planned = 0, actual = 0;
    (rec?.plan ?? []).forEach((b) => { const m = blockMin(b); planned += m; actual += b.actualMinutes ?? (rec?.eodAt ? m : 0); });
    const extra = (rec?.extra ?? []).reduce((a, x) => a + (x.minutes || 0), 0);
    return { d, planned, actual, extra, sent: !!rec?.eodAt };
  });
  const byProject = new Map<string, { planned: number; actual: number; extra: number }>();
  days.forEach((d) => {
    const rec = daily[`${personId}|${d}`];
    (rec?.plan ?? []).forEach((b) => {
      if (b.id === 'lunch') return;
      const pid = (b.custom ? b.custom.projectId ?? b.projectId : b.projectId) || `${OTHER}${b.custom?.title || 'Other work'}`;
      const r = byProject.get(pid) ?? { planned: 0, actual: 0, extra: 0 };
      const m = blockMin(b);
      r.planned += m; r.actual += b.actualMinutes ?? (rec?.eodAt ? m : 0);
      byProject.set(pid, r);
    });
    (rec?.extra ?? []).forEach((x) => {
      const pid = x.projectId ?? `${OTHER}${x.work || 'Extra work'}`;
      const r = byProject.get(pid) ?? { planned: 0, actual: 0, extra: 0 };
      r.extra += x.minutes || 0;
      byProject.set(pid, r);
    });
  });
  const tot = byDay.reduce((a, x) => ({ planned: a.planned + x.planned, actual: a.actual + x.actual, extra: a.extra + x.extra }), { planned: 0, actual: 0, extra: 0 });
  const projRows = [...byProject].sort((a, b) => b[1].actual + b[1].extra - (a[1].actual + a[1].extra) || b[1].planned - a[1].planned);
  const maxP = Math.max(1, ...projRows.map(([, r]) => Math.max(r.planned, r.actual + r.extra)));
  const th = 'pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted';
  return (
    <section id="weekly-hours" aria-label="Weekly hours" className="overflow-hidden rounded-card bg-surface shadow-soft">
      <div className="flex items-center gap-3 bg-mint/40 px-5 py-3">
        <CalendarRange size={18} className="text-mint-ink" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Weekly hours</h2>
          <p className="text-xs text-muted">{fmtDay(mon)} to {fmtDay(addDays(mon, 4))} · filled in from your day plans: where the week's time went</p>
        </div>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-xl bg-surface-2 px-3 py-2 text-sm" data-testid="week-hours-total">
          <span className="text-muted">Planned <b className="text-ink">{fmtMin(tot.planned)}</b></span>
          <span className="text-muted">Actual <b className="text-ink">{fmtMin(tot.actual)}</b></span>
          <span className="text-muted">Extra <b className="text-ink">{fmtMin(tot.extra)}</b></span>
          <span className="text-muted">Total worked <b className="text-ink">{fmtMin(tot.actual + tot.extra)}</b></span>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <table className="w-full text-sm" aria-label="Hours by day">
            <thead><tr className="border-b border-line text-left"><th className={th}>Day</th><th className={cx(th, 'text-right')}>Planned</th><th className={cx(th, 'text-right')}>Actual</th><th className={cx(th, 'text-right')}>Extra</th></tr></thead>
            <tbody>
              {byDay.map((x) => (
                <tr key={x.d} className="border-b border-line/70" data-week-hours-day={x.d}>
                  <td className="py-1.5">{WDN[new Date(`${x.d}T12:00:00`).getDay()]} {fmtDay(x.d)} {x.sent && <span className="ml-1 text-[10px] font-semibold text-mint-ink">sent</span>}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{x.planned ? fmtMin(x.planned) : '·'}</td>
                  <td className="py-1.5 text-right font-semibold tabular-nums">{x.actual ? fmtMin(x.actual) : '·'}</td>
                  <td className="py-1.5 text-right tabular-nums">{x.extra ? fmtMin(x.extra) : '·'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div aria-label="Hours by project">
            <p className={th}>By project</p>
            {projRows.length === 0 ? <p className="mt-1 text-sm text-muted">No day plans this week yet.</p> : (
              <ul className="mt-1 space-y-2">
                {projRows.map(([pid, r]) => (
                  <li key={pid} className="text-sm" data-week-hours-project={pid}>
                    <p className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 truncate font-medium"><span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: pid.startsWith(OTHER) ? '#64748B' : colorOf(projects, pid) }} />{groupName(pid, projects)}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">{fmtMin(r.actual + r.extra)} worked · {fmtMin(r.planned)} planned{r.extra ? ` · ${fmtMin(r.extra)} extra` : ''}</span>
                    </p>
                    <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full bg-sky-strong" style={{ width: `${(r.actual / maxP) * 100}%` }} />
                      <div className="h-full bg-lavender-strong" style={{ width: `${(r.extra / maxP) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
