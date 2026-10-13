import { useEffect, useMemo, useState } from 'react';
import { Clock3, Lock, Plus, Star, Trash2, Wand2 } from 'lucide-react';
import { toast } from '@/components';
import { toMinutes } from '../data';
import { dayTime } from '../analytics';
import { defaultPlan, emptyDaily, first, LUNCH, useStore, type CustomRow, type DayBlock, type ExtraHours, type ProjectNumbers } from '../store';
import { Btn, Card, cx, fmtMin, input, safe } from '../ui';
import { colorOf, DayTracker } from './Widgets';
import { AUTO_METRICS, CustomRows, DateNav, dayRows, DurationInput, HoursStats, lastWorkingDay, NoteView, PendingHint, ReportTable } from './DailyViews';
import { PlanBuilder } from './PlanBuilder';
import DayTaskLog, { TargetsProgress } from './DayTaskLog';
import { EodIcon, SodIcon, SUBMITTED, TaskLine, TimeBreakdown, UpdateSection, WeeklySections } from './TaskUpdateSections';

const TIMES = Array.from({ length: 19 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
let bid = 0;
const LUNCH_ROW: DayBlock = { id: 'lunch', start: LUNCH.start, end: LUNCH.end, projectId: '', taskIds: [] };
const field = 'focus-ring rounded-xl border border-line bg-surface px-2 py-1 text-sm text-ink';
const blockMin = (b: Pick<DayBlock, 'start' | 'end'>) => Math.max(0, toMinutes(b.end) - toMinutes(b.start));
/** Minutes between two "HH:mm" times, or undefined when either is missing or the end is not after the start. */
const span = (start?: string, end?: string) => (start && end && end > start ? toMinutes(end) - toMinutes(start) : undefined);
/** Drop extra-hours rows that were added but never filled in. */
const cleanExtra = (rows: ExtraHours[]) => rows.filter((x) => x.work.trim() || x.minutes || x.start || x.end);

/** Project numbers that are not counted from tasks (responses, calls, meetings...). */
function NumbersGrid({ value, onChange }: { value: ProjectNumbers; onChange: (v: ProjectNumbers) => void }) {
  const { me, projects } = useStore();
  const mine = projects.filter((p) => p.status === 'active' && (p.pmId === me || p.teamIds.includes(me) || p.admins?.includes(me)));
  return (
    <div className="space-y-3">
      {mine.map((p) => (
        <div key={p.id} className="rounded-xl border border-line p-3" style={{ borderLeft: `5px solid ${colorOf(projects, p.id)}` }}>
          <p className="mb-2 text-sm font-semibold">{p.name}</p>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {p.metrics.filter((m) => !AUTO_METRICS.has(m.id)).map((m) => (
              <label key={m.id} className="flex items-center justify-between gap-2 text-xs text-muted">
                {m.label}
                <input type="number" min={0} className={cx(field, 'w-20 shrink-0 text-right')} value={value[p.id]?.[m.id] || ''} placeholder="0"
                  onChange={(e) => onChange({ ...value, [p.id]: { ...value[p.id], [m.id]: Math.max(0, +e.target.value || 0) } })} />
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DailyUpdate() {
  const { me, projects, tasks, daily, saveDaily } = useStore();
  const [date, setDate] = useState(lastWorkingDay);
  const key = `${me}|${date}`;
  const saved = daily[key] ?? emptyDaily();
  const [plan, setPlan] = useState<DayBlock[]>(saved.plan);
  const [extra, setExtra] = useState<ExtraHours[]>(saved.extra ?? []);
  const [sodNote, setSodNote] = useState(saved.sodNote);
  const [sodTargets, setSodTargets] = useState<ProjectNumbers>(saved.sodTargets);
  const [eodNote, setEodNote] = useState(saved.eodNote);
  const [eodActuals, setEodActuals] = useState<ProjectNumbers>(saved.eodActuals);
  const [sodCustom, setSodCustom] = useState<CustomRow[]>(saved.sodCustom ?? []);
  const [eodCustom, setEodCustom] = useState<CustomRow[]>(saved.eodCustom ?? []);
  const [editSod, setEditSod] = useState(false);
  const [editEod, setEditEod] = useState(false);
  // Reload the form when switching person or date.
  useEffect(() => {
    const d = useStore.getState().daily[`${me}|${date}`] ?? emptyDaily();
    setEditSod(false); setEditEod(false);
    setPlan(d.plan); setExtra(d.extra ?? []); setSodCustom(d.sodCustom ?? []); setEodCustom(d.eodCustom ?? []);
    setSodNote(d.sodNote); setSodTargets(d.sodTargets); setEodNote(d.eodNote); setEodActuals(d.eodActuals);
  }, [me, date]);
  /** After a save, pick up what the store normalised (ids, minutes from start / end). */
  const resync = () => {
    const d = useStore.getState().daily[`${me}|${date}`];
    if (d) { setPlan(d.plan); setExtra(d.extra ?? []); }
  };

  const myProjects = projects.filter((p) => p.status === 'active' && (p.pmId === me || p.teamIds.includes(me) || p.admins?.includes(me)));
  const dayTasks = useMemo(() => tasks.filter((t) => t.assigneeId === me && t.date === date), [tasks, me, date]);
  const doneToday = useMemo(() => dayTasks.filter(SUBMITTED), [dayTasks]);
  const sent = !!saved.eodAt;
  const time = dayTime({ plan, extra, eodAt: saved.eodAt });
  const savedRows = useMemo(() => dayRows(tasks, projects, me, date, daily[key]), [tasks, projects, me, date, daily, key]);
  const draftRows = useMemo(() => dayRows(tasks, projects, me, date, { ...saved, plan }, ['task', 'block']), [tasks, projects, me, date, saved, plan]);

  const upd = (id: string, p: Partial<DayBlock>) => setPlan((x) => x.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const updC = (id: string, c: Partial<NonNullable<DayBlock['custom']>>) => setPlan((x) => x.map((b) => (b.id === id && b.custom ? { ...b, custom: { ...b.custom, ...c } } : b)));
  const updX = (id: string, p: Partial<ExtraHours>) => setExtra((x) => x.map((r) => {
    if (r.id !== id) return r;
    const n = { ...r, ...p };
    const s = span(n.start, n.end);
    return s != null ? { ...n, minutes: s } : n;
  }));
  const addBlock = () => {
    let last = [...plan].sort((a, b) => a.end.localeCompare(b.end)).at(-1)?.end ?? '10:00';
    if (last >= LUNCH.start && last < LUNCH.end) last = LUNCH.end;
    const endIdx = Math.min(TIMES.length - 1, last < LUNCH.start ? TIMES.indexOf(LUNCH.start) : TIMES.indexOf(last) + 4);
    if (last >= '19:00') return toast({ title: 'Your day is already planned up to 7pm', tone: 'info' });
    setPlan((x) => [...x, { id: `nb${Date.now().toString(36)}${++bid}`, start: last, end: TIMES[endIdx], projectId: myProjects[0]?.id ?? '', taskIds: [] }]);
  };
  const addExtra = () => setExtra((x) => [...x, { id: `nx${Date.now().toString(36)}${++bid}`, minutes: 0, work: '', projectId: myProjects[0]?.id }]);
  const scrollToPlan = () => document.getElementById('plan-your-day')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl font-bold">Tasks update</h1>
          <p className="text-sm text-muted">Plan your day and record the real time it took. Targets and actuals fill in from your tasks. Working hours 10am to 7pm, lunch 1pm to 2pm.</p>
        </div>
        <DateNav date={date} onChange={setDate} />
      </div>


      <section id="plan-your-day" aria-label="Plan your day" className="scroll-mt-20">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">Plan your day</h2>
            <HoursStats t={time} sent={sent} />
          </div>
          <PlanBuilder plan={plan} setPlan={setPlan} extra={extra} personId={me} date={date} />

          <div className="mt-6 border-t border-line pt-4" aria-label="Extra hours" role="group">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-bold">Extra hours</p>
              <p className="text-xs text-muted">Worked outside your plan? Add the time (start and end, or just how long) and what it was for.</p>
            </div>
            {extra.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="hidden items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted sm:flex" aria-hidden>
                  <span className="w-[7.75rem]">From</span><span className="w-[7.75rem]">To</span><span className="w-20 text-right">Time</span>
                  <span className="min-w-[12rem] flex-1">What you worked on</span><span className="w-44">Project</span><span className="w-8" />
                </div>
                {extra.map((x) => {
                  const fixed = span(x.start, x.end) != null;
                  return (
                    <div key={x.id} data-extra={x.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2/60 p-1">
                      <input aria-label="Extra start" type="time" step={300} className={cx(field, 'w-[7.75rem]')} value={x.start ?? ''} onChange={(e) => updX(x.id, { start: e.target.value || undefined })} />
                      <input aria-label="Extra end" type="time" step={300} className={cx(field, 'w-[7.75rem]')} value={x.end ?? ''} onChange={(e) => updX(x.id, { end: e.target.value || undefined })} />
                      <DurationInput label="Extra duration" className="w-20" placeholder="45m" disabled={fixed} value={x.minutes || undefined} onChange={(m) => updX(x.id, { minutes: m ?? 0 })} />
                      <input aria-label="Extra work" className={cx(field, 'min-w-[12rem] flex-1')} placeholder="e.g. Call list cleanup before the shift" value={x.work} onChange={(e) => updX(x.id, { work: e.target.value })} />
                      <select aria-label="Extra project" className={cx(field, 'w-44')} value={x.projectId ?? ''} onChange={(e) => updX(x.id, { projectId: e.target.value || undefined })}>
                        <option value="">No project</option>
                        {myProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <button aria-label="Remove extra hours" className="focus-ring w-8 rounded-lg p-1.5 text-muted hover:bg-surface hover:text-coral-ink" onClick={() => setExtra((r) => r.filter((y) => y.id !== x.id))}><Trash2 size={15} /></button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Btn tone="soft" onClick={addExtra}><Clock3 size={14} /> Add extra hours</Btn>
              <Btn className="ml-auto" onClick={() => safe(() => { saveDaily(me, date, { plan, extra: cleanExtra(extra) }); resync(); toast({ title: 'Plan and times saved', tone: 'success' }); })}>Save plan and times</Btn>
            </div>
          </div>
        </Card>
      </section>

      <DayTaskLog personId={me} date={date} plan={plan} extra={extra} />
      <DayTaskLog personId={me} date={date} kind="week" />

      <div className="border-t-2 border-dashed border-line pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Auto-filled updates</h2>
          <DateNav date={date} onChange={setDate} />
        </div>
        <p className="text-sm text-muted">Built from the daily and weekly tasks above and your assigned tasks. Targets against what got achieved, updated as you go.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <UpdateSection id="todays-targets" icon={SodIcon} tone="bg-butter/50" title="Today's targets" subtitle="Built from the tasks your project managers gave you"
          lockedAt={saved.sodAt} editing={editSod} onEdit={() => setEditSod(true)}
          view={<>
            <TargetsProgress personId={me} date={date} kind="day" />
            <TaskLine tasks={dayTasks} mode="assigned" />
            <NoteView label="Note" text={saved.sodNote} />
          </>}>
          <TargetsProgress personId={me} date={date} kind="day" />
          <TaskLine tasks={dayTasks} mode="assigned" />
          <CustomRows rows={sodCustom} onChange={setSodCustom} title="Custom targets" hint="anything else you're aiming for today" />
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-semibold">Project numbers to hit <span className="font-normal text-muted">(optional: responses, calls, meetings)</span></summary>
            <div className="mt-3"><NumbersGrid value={sodTargets} onChange={setSodTargets} /></div>
          </details>
          <label className="block text-sm font-semibold">Note <span className="font-normal text-muted">(optional)</span>
            <textarea rows={2} className={cx(input, 'mt-1')} value={sodNote} onChange={(e) => setSodNote(e.target.value)} placeholder="e.g. QBR deck first, then personalised L1s" />
          </label>
          <Btn onClick={() => safe(() => { saveDaily(me, date, { plan, sodNote, sodTargets, sodCustom: sodCustom.filter((r) => r.label.trim()), sodAt: new Date().toISOString() }); resync(); setEditSod(false); toast({ title: "Today's targets locked 🎯", tone: 'success' }); })}><Lock size={13} /> Save & lock</Btn>
        </UpdateSection>

        <UpdateSection id="end-of-day" icon={EodIcon} tone="bg-lavender/50" title="End of day update" subtitle="Actuals fill in from the tasks you submitted"
          lockedAt={saved.eodAt} lockedLabel="Sent" editing={editEod} onEdit={() => setEditEod(true)}
          view={<>
            <TaskLine tasks={doneToday} mode="submitted" />
            <TimeBreakdown plan={saved.plan} extra={saved.extra ?? []} sent />
            <NoteView label="How it went" text={saved.eodNote} />
          </>}>
          <TimeBreakdown plan={plan} extra={cleanExtra(extra)} sent={false} />
          <TaskLine tasks={doneToday} mode="submitted" />
          {!sent && savedRows.rows.length > 0 && <PendingHint>Fills in when you send your end of day</PendingHint>}
          {plan.some((b) => b.custom) && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Custom blocks <span className="font-normal text-muted">· how much got done</span></p>
              {plan.filter((b) => b.custom).map((b) => (
                <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm" style={{ borderLeft: `5px solid ${b.custom!.priority ? '#DC2626' : '#64748B'}` }}>
                  <span className="min-w-0 flex-1"><b>{b.custom!.priority && '★ '}{b.custom!.title || 'Custom block'}</b><span className="block text-xs text-muted">{b.start} to {b.end} · target {b.custom!.targetQty || 0} {b.custom!.unit}</span></span>
                  <label className="flex items-center gap-1.5 text-xs text-muted">Achieved
                    <input aria-label="Achieved" type="number" min={0} className={cx(field, 'w-20 text-right')} value={b.custom!.achieved ?? ''} placeholder="0" onChange={(e) => updC(b.id, { achieved: Math.max(0, +e.target.value || 0) })} />
                  </label>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
            <HoursStats t={time} sent={sent} />
            <button className="focus-ring rounded-lg px-1 text-xs font-semibold text-accent-ink hover:underline" onClick={scrollToPlan}>Record actual time and extra hours</button>
          </div>
          <CustomRows rows={eodCustom} onChange={setEodCustom} title="Custom results" hint="anything extra you got done today" suggest={sodCustom} />
          <details className="rounded-xl border border-line p-3">
            <summary className="cursor-pointer text-sm font-semibold">Project numbers <span className="font-normal text-muted">(responses, calls, meetings)</span></summary>
            <p className="mt-2 text-xs text-muted">Messages and decks are counted from your submitted tasks automatically.</p>
            <div className="mt-3"><NumbersGrid value={eodActuals} onChange={setEodActuals} /></div>
          </details>
          <label className="block text-sm font-semibold">How did today go?
            <textarea rows={2} className={cx(input, 'mt-1')} value={eodNote} onChange={(e) => setEodNote(e.target.value)} placeholder="Wins, blockers, what carries over to tomorrow" />
          </label>
          <Btn onClick={() => safe(() => { saveDaily(me, date, { plan, extra: cleanExtra(extra), eodNote, eodActuals, eodCustom: eodCustom.filter((r) => r.label.trim()), eodAt: new Date().toISOString() }); resync(); setEditEod(false); toast({ title: `End of day sent, nice work ${first(me)} 🌙 Your numbers for the day are now final.`, tone: 'success' }); })}><Lock size={13} /> Send & lock</Btn>
        </UpdateSection>
      </div>

      <WeeklySections personId={me} date={date} />
    </div>
  );
}
