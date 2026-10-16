import { fmtDay } from '../data';
import { useEffect, useMemo, useState } from 'react';
import {  Lock } from 'lucide-react';
import { toast } from '@/components';

import { dayTime } from '../analytics';
import {  emptyDaily, useStore, type CustomRow, type DayBlock, type ExtraHours, type ProjectNumbers , leaveOn } from '../store';
import { Btn, Card, cx, input, safe } from '../ui';
import { colorOf } from './Widgets';
import { AUTO_METRICS, CustomRows, DateNav, HoursStats, lastWorkingDay, NoteView } from './DailyViews';
import { PlanBuilder } from './PlanBuilder';
import DayTaskLog, { TargetsProgress, WeeklyAuto, WeeklyHours } from './DayTaskLog';
import { EodIcon, SodIcon, TaskLine, TimeBreakdown, UpdateSection } from './TaskUpdateSections';

const field = 'focus-ring rounded-xl border border-line bg-surface px-2 py-1 text-sm text-ink';
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
  const { me, tasks, daily, saveDaily, profiles } = useStore();
  const [date, setDate] = useState(lastWorkingDay);
  const leaveToday = leaveOn(profiles, me, date);
  const key = `${me}|${date}`;
  const saved = daily[key] ?? emptyDaily();
  const [plan, setPlan] = useState<DayBlock[]>(saved.plan);
  const [extra, setExtra] = useState<ExtraHours[]>(saved.extra ?? []);
  const [sodNote, setSodNote] = useState(saved.sodNote);
  const [sodTargets, setSodTargets] = useState<ProjectNumbers>(saved.sodTargets);
  const [sodCustom, setSodCustom] = useState<CustomRow[]>(saved.sodCustom ?? []);
  const [editSod, setEditSod] = useState(false);
  // Reload the form when switching person or date.
  useEffect(() => {
    // Assigned tasks (and today, unfinished ones from earlier days) drop into the daily update with a time block.
    useStore.getState().syncDay(me, date);
    const d = useStore.getState().daily[`${me}|${date}`] ?? emptyDaily();
    setEditSod(false);
    setPlan(d.plan); setExtra(d.extra ?? []); setSodCustom(d.sodCustom ?? []);
    setSodNote(d.sodNote); setSodTargets(d.sodTargets);
  }, [me, date]);
  /** After a save, pick up what the store normalised (ids, minutes from start / end). */
  const resync = () => {
    const d = useStore.getState().daily[`${me}|${date}`];
    if (d) { setPlan(d.plan); setExtra(d.extra ?? []); }
  };

  const dayTasks = useMemo(() => tasks.filter((t) => t.assigneeId === me && t.date === date), [tasks, me, date]);
  const sent = !!saved.eodAt;
  const time = dayTime({ plan, extra, eodAt: saved.eodAt });


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl font-bold">Tasks update</h1>
          <p className="text-sm text-muted">Plan your day and record the real time it took. Targets and actuals fill in from your tasks. Working hours 10am to 7pm, lunch 1pm to 2pm.</p>
        </div>
        <DateNav date={date} onChange={setDate} />
      </div>
      {leaveToday && <div className="flex items-center gap-2 rounded-2xl border border-lavender-strong/40 bg-lavender/40 px-4 py-3 text-sm" data-testid="leave-banner">🌴 <b>{leaveToday.kind === 'half' ? 'Half day leave' : 'On leave'}</b> on {fmtDay(date)}{leaveToday.note ? ` · ${leaveToday.note}` : ''}. Managers see this instead of missing updates.</div>}


      <section id="plan-your-day" aria-label="Plan your day" className="scroll-mt-20">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold">Plan your day</h2>
            <HoursStats t={time} sent={sent} />
          </div>
          <PlanBuilder plan={plan} setPlan={setPlan} extra={extra} setExtra={setExtra} personId={me} date={date} />

          <div className="mt-4 flex justify-end">
            <Btn onClick={() => safe(() => { saveDaily(me, date, { plan, extra: cleanExtra(extra) }); resync(); toast({ title: 'Plan and times saved', tone: 'success' }); })}>Save plan and times</Btn>
          </div>
        </Card>
      </section>

      <DayTaskLog personId={me} date={date} plan={plan} extra={extra} />

      <div className="border-t-2 border-dashed border-line pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Auto-filled updates</h2>
          <DateNav date={date} onChange={setDate} />
        </div>
        <p className="text-sm text-muted">Built from the daily and weekly tasks above and your assigned tasks. Targets against what got achieved, updated as you go.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <UpdateSection id="todays-targets" icon={SodIcon} tone="bg-butter/50" title="Today's targets" subtitle="Built from the tasks your project managers gave you"
          lockedAt={saved.sodAt} editing={editSod}
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

        <section id="todays-hours" aria-label="Today's hours" className="overflow-hidden rounded-card bg-surface shadow-soft">
          <div className="flex items-center gap-3 bg-lavender/50 px-5 py-3">
            {EodIcon}
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">Today's hours</h2>
              <p className="text-xs text-muted">Filled in from your day plan: blocks, actual time and extra hours</p>
            </div>
          </div>
          <div className="space-y-3 px-5 py-4">
            <div className="rounded-xl bg-surface-2 px-3 py-2"><HoursStats t={time} sent={sent} /></div>
            {plan.length || extra.length
              ? <TimeBreakdown plan={plan} extra={cleanExtra(extra)} sent={sent} />
              : <p className="text-sm text-muted">No plan for this day yet. Add blocks in Plan your day.</p>}
          </div>
        </section>
      </div>

      <WeeklyAuto personId={me} date={date} />
      <WeeklyHours personId={me} date={date} />
    </div>
  );
}
