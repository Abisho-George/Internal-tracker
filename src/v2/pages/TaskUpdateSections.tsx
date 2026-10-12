import { useEffect, useState, type ReactNode } from 'react';
import { CalendarCheck2, CalendarRange, Lock, Moon, Pencil, Sunrise } from 'lucide-react';
import { toast } from '@/components';
import { TASK_TYPES, type Task } from '../data';
import { emptyWeekly, first, onTimeRate, useStore, type CustomRow } from '../store';
import { Btn, Card, Chip, STATUS, cx, fmtMin, input, safe } from '../ui';
import { PaceChip } from './TaskCard';
import { colorOf } from './Widgets';
import { CustomRows, CustomRowsView } from './DailyViews';

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
const short = (d: string) => new Date(d + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Header + locked/editing shell shared by all four sections. */
export function UpdateSection({ icon, tone, title, subtitle, lockedAt, editing, onEdit, children, view }: {
  icon: ReactNode; tone: string; title: string; subtitle: string; lockedAt?: string; editing: boolean; onEdit: () => void; children: ReactNode; view: ReactNode;
}) {
  const locked = !!lockedAt && !editing;
  return (
    <Card className="flex flex-col p-0">
      <div className={cx('flex items-center gap-3 rounded-t-card border-b border-line px-5 py-3', tone)}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/70">{icon}</span>
        <div className="min-w-0 flex-1"><p className="font-bold">{title}</p><p className="text-xs text-muted">{subtitle}</p></div>
        {lockedAt ? <Chip tone="mint"><Lock size={11} /> Locked {new Date(lockedAt).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</Chip> : <Chip tone="butter">Not sent yet</Chip>}
      </div>
      <div className="flex-1 space-y-4 p-5">{locked ? view : children}</div>
      {locked && <div className="border-t border-line px-5 py-3"><Btn tone="ghost" className="border border-line" onClick={onEdit}><Pencil size={13} /> Edit</Btn></div>}
    </Card>
  );
}

/** Tasks grouped by project — "assigned" shows targets, "submitted" shows what was done and how long it took. */
export function AutoTasks({ tasks, mode, empty }: { tasks: Task[]; mode: 'assigned' | 'submitted'; empty: string }) {
  const projects = useStore((s) => s.projects);
  if (!tasks.length) return <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">{empty}</p>;
  const ids = [...new Set(tasks.map((t) => t.projectId))];
  return (
    <div className="space-y-2">
      {ids.map((pid) => {
        const list = tasks.filter((t) => t.projectId === pid);
        const p = projects.find((x) => x.id === pid);
        return (
          <div key={pid} className="overflow-hidden rounded-xl border border-line" style={{ borderLeft: `4px solid ${colorOf(projects, pid)}` }}>
            <p className="flex items-center justify-between bg-surface-2 px-3 py-1.5 text-xs font-bold">{p?.name ?? 'Project'}<span className="font-medium text-muted">{list.length} task{list.length === 1 ? '' : 's'}</span></p>
            <ul className="divide-y divide-line">
              {list.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 first-letter:uppercase">{t.title}{t.priority && <span className="ml-1 text-coral-ink">★</span>}</span>
                  {mode === 'assigned' ? (
                    <><span className="text-xs text-muted">target {fmtMin(t.targetMinutes)}</span><Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip></>
                  ) : (
                    <><span className="text-xs text-muted">{t.doneQty}/{t.qty} {t.unit} · {fmtMin(t.minutes ?? 0)}</span><PaceChip task={t} /></>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** One-line summary chips for a set of tasks. */
export function TaskSummary({ tasks, mode }: { tasks: Task[]; mode: 'assigned' | 'submitted' }) {
  if (!tasks.length) return null;
  if (mode === 'assigned') {
    const mins = tasks.reduce((s, t) => s + t.targetMinutes, 0);
    return <div className="flex flex-wrap gap-1.5"><Chip tone="sky">{tasks.length} tasks</Chip><Chip tone="lavender">{fmtMin(mins)} of work</Chip>{tasks.some((t) => t.priority) && <Chip tone="coral">★ {tasks.filter((t) => t.priority).length} priority</Chip>}</div>;
  }
  const rate = onTimeRate(tasks);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip tone="mint">✓ {tasks.filter((t) => t.status === 'done').length} approved</Chip>
      <Chip tone="lavender">{tasks.filter((t) => t.status === 'in_review').length} in review</Chip>
      <Chip tone="sky">{fmtMin(tasks.reduce((s, t) => s + (t.minutes ?? 0), 0))} logged</Chip>
      {rate && <Chip tone={rate.pct >= 80 ? 'mint' : 'butter'}>{rate.onTime}/{rate.total} on time</Chip>}
    </div>
  );
}

/** Totals by task type for the week, e.g. "Personalised 1st level messages: 90 messages". */
function TypeTotals({ tasks, field }: { tasks: Task[]; field: 'qty' | 'doneQty' }) {
  const m = new Map<string, { n: number; unit: string }>();
  tasks.forEach((t) => {
    const name = t.typeId === 'custom' ? t.title.replace(/^\d+\s*/, '') : `${t.variant ? t.variant + ' ' : ''}${TASK_TYPES.find((x) => x.id === t.typeId)?.name.toLowerCase() ?? ''}`;
    const cur = m.get(name) ?? { n: 0, unit: t.unit };
    m.set(name, { n: cur.n + (t[field] ?? 0), unit: t.unit });
  });
  if (!m.size) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {[...m.entries()].map(([name, v]) => (
        <div key={name} className="rounded-xl border border-line bg-surface-2 px-3 py-2">
          <p className="text-xl font-extrabold leading-none">{v.n}<span className="ml-1 text-xs font-medium text-muted">{v.unit}</span></p>
          <p className="mt-0.5 text-xs text-muted first-letter:uppercase">{name}</p>
        </div>
      ))}
    </div>
  );
}

/** Weekly targets + end-of-week update. Auto-filled from the week's tasks; note + custom rows are editable. */
export function WeeklySections({ personId, date }: { personId: string; date: string }) {
  const { tasks, weekly, saveWeekly } = useStore();
  const [mon, fri] = weekOf(date);
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
  const week = tasks.filter((t) => t.assigneeId === personId && t.date >= mon && t.date <= fri);
  const done = week.filter(SUBMITTED);
  const label = `${short(mon)} – ${short(fri)}`;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <UpdateSection icon={<CalendarRange size={18} className="text-sky-ink" />} tone="bg-sky/40" title="Weekly targets" subtitle={`Week of ${label} · filled from tasks assigned this week`}
        lockedAt={saved.targetsAt} editing={editT} onEdit={() => setEditT(true)}
        view={<>
          <TaskSummary tasks={week} mode="assigned" />
          <TypeTotals tasks={week} field="qty" />
          {saved.targetsNote && <p className="rounded-xl bg-surface-2 p-3 text-sm">“{saved.targetsNote}”</p>}
          <CustomRowsView rows={saved.targetsCustom} />
        </>}>
        <TaskSummary tasks={week} mode="assigned" />
        <TypeTotals tasks={week} field="qty" />
        <label className="block text-sm font-semibold">Focus for the week
          <textarea rows={2} className={cx(input, 'mt-1')} value={tNote} onChange={(e) => setTNote(e.target.value)} placeholder="e.g. 300 personalised L1s and 4 meetings booked" />
        </label>
        <CustomRows rows={tCustom} onChange={setTCustom} hint="any other weekly goal" />
        <Btn onClick={() => safe(() => { saveWeekly(personId, mon, { targetsNote: tNote, targetsCustom: tCustom.filter((r) => r.label.trim()), targetsAt: new Date().toISOString() }); setEditT(false); toast({ title: 'Weekly targets locked 📅', tone: 'success' }); })}><Lock size={13} /> Save & lock</Btn>
      </UpdateSection>

      <UpdateSection icon={<CalendarCheck2 size={18} className="text-mint-ink" />} tone="bg-mint/40" title="End of week update" subtitle={`Week of ${label} · filled from tasks you submitted`}
        lockedAt={saved.eowAt} editing={editE} onEdit={() => setEditE(true)}
        view={<>
          <TaskSummary tasks={done} mode="submitted" />
          <TypeTotals tasks={done} field="doneQty" />
          {saved.eowNote && <p className="rounded-xl bg-surface-2 p-3 text-sm">“{saved.eowNote}”</p>}
          <CustomRowsView rows={saved.eowCustom} targets={saved.targetsCustom} />
        </>}>
        <TaskSummary tasks={done} mode="submitted" />
        <TypeTotals tasks={done} field="doneQty" />
        {!done.length && <p className="text-sm text-muted">Nothing submitted yet this week.</p>}
        <label className="block text-sm font-semibold">How did the week go?
          <textarea rows={2} className={cx(input, 'mt-1')} value={eNote} onChange={(e) => setENote(e.target.value)} placeholder="Wins, blockers, what moves to next week" />
        </label>
        <CustomRows rows={eCustom} onChange={setECustom} hint="anything extra you worked on this week" suggest={tCustom} />
        <Btn onClick={() => safe(() => { saveWeekly(personId, mon, { eowNote: eNote, eowCustom: eCustom.filter((r) => r.label.trim()), eowAt: new Date().toISOString() }); setEditE(false); toast({ title: `Week wrapped up — have a good weekend, ${first(personId)} 🎉`, tone: 'success' }); })}><Lock size={13} /> Send & lock</Btn>
      </UpdateSection>
    </div>
  );
}

export const SodIcon = <Sunrise size={18} className="text-butter-ink" />;
export const EodIcon = <Moon size={18} className="text-accent-ink" />;
