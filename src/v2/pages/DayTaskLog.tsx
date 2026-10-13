import { useEffect, useMemo, useState } from 'react';
import { Lock, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from '@/components';
import { TASK_TYPES, toMinutes } from '../data';
import { emptyDaily, useStore, type DayBlock, type TaskEntry } from '../store';
import { Btn, Card, Chip, cx, fmtMin, safe } from '../ui';
import { colorOf } from './Widgets';
import { DurationInput, hhmm } from './DailyViews';

const field = 'focus-ring w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink';
const CUSTOM = '__custom';
let eid = 0;
const blockMin = (b: DayBlock) => Math.max(0, toMinutes(b.end) - toMinutes(b.start));
const blank = (projectId: string): TaskEntry => ({ id: `e${Date.now().toString(36)}${eid++}`, projectId, task: '', desc: '', estMin: 0, achieved: '', remarks: '' });
const taskName = (e: TaskEntry, opts: { id: string; name: string }[]) => (e.task === CUSTOM ? e.custom || 'Custom task' : opts.find((o) => o.id === e.task)?.name ?? e.task);

/**
 * Daily update built from the day plan: every project with a time block gets its own table of task rows
 * (task, description, estimated, actual, achieved, remarks) with totals against the planned time.
 */
export default function DayTaskLog({ personId, date, plan, readOnly }: { personId: string; date: string; plan?: DayBlock[]; readOnly?: boolean }) {
  const { projects, daily, saveDaily } = useStore();
  const saved = daily[`${personId}|${date}`] ?? emptyDaily();
  const blocks = plan ?? saved.plan;
  const [rows, setRows] = useState<TaskEntry[]>(saved.entries ?? []);
  const [editing, setEditing] = useState(false);
  useEffect(() => { setRows(saved.entries ?? []); setEditing(false); }, [personId, date]); // eslint-disable-line react-hooks/exhaustive-deps
  const locked = !!saved.entriesAt && !editing;

  // Projects in the order they appear in the plan, with planned minutes. Projects that already have rows stay listed.
  const groups = useMemo(() => {
    const planned = new Map<string, number>();
    [...blocks].sort((a, b) => a.start.localeCompare(b.start)).forEach((b) => {
      const pid = b.custom ? b.custom.projectId ?? b.projectId : b.projectId;
      if (pid) planned.set(pid, (planned.get(pid) ?? 0) + blockMin(b));
    });
    (readOnly ? saved.entries ?? [] : rows).forEach((e) => { if (!planned.has(e.projectId)) planned.set(e.projectId, 0); });
    return [...planned].map(([pid, min]) => ({ project: projects.find((p) => p.id === pid), pid, planned: min })).filter((g) => g.project);
  }, [blocks, rows, projects, readOnly, saved.entries]);

  const list = readOnly ? saved.entries ?? [] : rows;
  const upd = (id: string, p: Partial<TaskEntry>) => setRows((r) => r.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const clean = () => rows.filter((e) => e.task && (e.task !== CUSTOM || e.custom?.trim()));
  const save = (lock: boolean) => safe(() => {
    const keep = clean();
    if (lock && !keep.length) throw new Error('Add at least one task before locking.');
    saveDaily(personId, date, { entries: keep, ...(lock ? { entriesAt: new Date().toISOString() } : {}) });
    setRows(keep);
    setEditing(false);
    toast({ title: lock ? 'Daily update locked 🔒' : 'End of day recorded ✓', tone: 'success' });
  });
  const all = list.reduce((a, e) => ({ est: a.est + e.estMin, act: a.act + (e.actualMin ?? 0) }), { est: 0, act: 0 });
  const plannedAll = groups.reduce((a, g) => a + g.planned, 0);

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-base font-bold">Daily update</h2>
          <p className="text-xs text-muted">{readOnly ? 'Tasks per project for the day.' : 'One table for every project in your plan. Add the tasks, lock it, then fill in actual time, achieved and remarks at the end of the day.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {saved.entriesAt ? <Chip tone="mint">Locked {hhmm(saved.entriesAt)}</Chip> : <Chip tone="grey">Not locked yet</Chip>}
          {!readOnly && locked && <Btn tone="ghost" className="border border-line" onClick={() => setEditing(true)}><Pencil size={13} /> Update tasks</Btn>}
        </div>
      </div>

      {groups.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">{readOnly ? 'No plan for this day.' : 'Add time blocks to your plan above and a table opens here for each project.'}</p>}

      <div className="space-y-4 p-4">
        {groups.map(({ project, pid, planned }) => {
          const opts = [...TASK_TYPES.map((t) => ({ id: t.id, name: t.name })), ...(project!.customStandards ?? []).map((c) => ({ id: `std:${c.id}`, name: c.name }))];
          const mine = list.filter((e) => e.projectId === pid);
          const est = mine.reduce((a, e) => a + e.estMin, 0);
          const act = mine.reduce((a, e) => a + (e.actualMin ?? 0), 0);
          return (
            <section key={pid} data-project-log={pid} className="overflow-hidden rounded-xl border border-line" style={{ borderLeft: `5px solid ${colorOf(projects, pid)}` }}>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-2/60 px-3 py-2">
                <p className="font-semibold">{project!.name}</p>
                <p className="text-xs text-muted">Planned <b className="text-ink">{fmtMin(planned)}</b></p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm" aria-label={`${project!.name} tasks`}>
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <th className="w-52 px-2 py-1.5">Task</th><th className="px-2 py-1.5">Description <span className="normal-case">(optional)</span></th>
                      <th className="w-24 px-2 py-1.5">Estimated</th><th className="w-24 px-2 py-1.5">Actual</th>
                      <th className="w-44 px-2 py-1.5">Targets achieved</th><th className="w-44 px-2 py-1.5">Remarks</th>{!readOnly && !locked && <th className="w-8" />}
                    </tr>
                  </thead>
                  <tbody>
                    {mine.length === 0 && <tr><td colSpan={7} className="px-2 py-3 text-xs text-muted">No tasks yet.</td></tr>}
                    {mine.map((e) => (
                      <tr key={e.id} data-entry={e.id} className="border-t border-line align-top">
                        <td className="px-2 py-1.5">
                          {readOnly || locked ? <span className="font-medium">{taskName(e, opts)}</span> : <>
                            <select aria-label="Task" className={field} value={e.task} onChange={(x) => upd(e.id, { task: x.target.value })}>
                              <option value="">Pick a task</option>
                              {opts.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                              <option value={CUSTOM}>Custom...</option>
                            </select>
                            {e.task === CUSTOM && <input aria-label="Custom task name" autoFocus className={cx(field, 'mt-1')} placeholder="Task name" value={e.custom ?? ''} onChange={(x) => upd(e.id, { custom: x.target.value })} />}
                          </>}
                        </td>
                        <td className="px-2 py-1.5">{readOnly || locked ? <span className="text-muted">{e.desc || '·'}</span>
                          : <input aria-label="Description" className={field} placeholder="e.g. 30 personalised for the CFO list" value={e.desc} onChange={(x) => upd(e.id, { desc: x.target.value })} />}</td>
                        <td className="px-2 py-1.5">{readOnly || locked ? <span className="tabular-nums">{fmtMin(e.estMin)}</span>
                          : <DurationInput label="Estimated time" className="w-24" placeholder="1h" value={e.estMin || undefined} onChange={(m) => upd(e.id, { estMin: m ?? 0 })} />}</td>
                        <td className="px-2 py-1.5">{readOnly ? <span className="tabular-nums">{e.actualMin != null ? fmtMin(e.actualMin) : '·'}</span>
                          : <DurationInput label="Actual time" className="w-24" placeholder="..." value={e.actualMin} onChange={(m) => upd(e.id, { actualMin: m ?? undefined })} />}</td>
                        <td className="px-2 py-1.5">{readOnly ? <span>{e.achieved || '·'}</span>
                          : <input aria-label="Targets achieved" className={field} placeholder="e.g. 28 of 30" value={e.achieved} onChange={(x) => upd(e.id, { achieved: x.target.value })} />}</td>
                        <td className="px-2 py-1.5">{readOnly ? <span>{e.remarks || '·'}</span>
                          : <input aria-label="Remarks" className={field} placeholder="Anything to note" value={e.remarks} onChange={(x) => upd(e.id, { remarks: x.target.value })} />}</td>
                        {!readOnly && !locked && <td className="py-1.5"><button aria-label="Remove task" className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => setRows((r) => r.filter((y) => y.id !== e.id))}><Trash2 size={14} /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-surface-2/40 text-xs font-semibold">
                      <td className="px-2 py-2">{!readOnly && !locked
                        ? <button className="focus-ring flex items-center gap-1 rounded-full border border-line px-3 py-1 text-accent-ink hover:bg-surface-2" onClick={() => setRows((r) => [...r, blank(pid)])}><Plus size={12} /> Add task</button>
                        : null}</td>
                      <td className="px-2 py-2 text-right text-muted">Total</td>
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
          <p className="text-sm">Day total: planned <b>{fmtMin(plannedAll)}</b> · estimated <b data-testid="day-est">{fmtMin(all.est)}</b> · actual <b data-testid="day-act">{fmtMin(all.act)}</b></p>
          {!readOnly && (
            <span className="ml-auto flex gap-2">
              {locked
                ? <Btn onClick={() => save(false)}><Save size={13} /> Save end of day</Btn>
                : <Btn onClick={() => save(true)}><Lock size={13} /> {saved.entriesAt ? 'Update and lock' : 'Lock tasks'}</Btn>}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
