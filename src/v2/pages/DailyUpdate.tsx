import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Moon, Plus, Star, Sunrise, Trash2, Wand2 } from 'lucide-react';
import { toast } from '@/components';
import { day } from '../data';
import { defaultPlan, emptyDaily, first, useStore, type DayBlock, type ProjectNumbers } from '../store';
import { Btn, Card, Chip, H2, cx, fmtMin, input, safe } from '../ui';
import { colorOf, DayTracker } from './Widgets';

const TIMES = Array.from({ length: 19 }, (_, i) => `${String(10 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);
/** Numbers that are already counted from submitted tasks — don't ask for them again at end of day. */
const AUTO = new Set(['messages', 'l2', 'decks']);
const shift = (d: string, n: number) => { const x = new Date(d + 'T00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
let bid = 0;
const field = 'focus-ring rounded-xl border border-line bg-surface px-2 py-1 text-sm';

function NumbersGrid({ value, onChange, skipAuto }: { value: ProjectNumbers; onChange: (v: ProjectNumbers) => void; skipAuto?: boolean }) {
  const { me, projects } = useStore();
  const mine = projects.filter((p) => p.status === 'active' && (p.pmId === me || p.teamIds.includes(me)));
  return (
    <div className="space-y-3">
      {mine.map((p) => (
        <div key={p.id} className="rounded-xl border border-line p-3" style={{ borderLeft: `5px solid ${colorOf(projects, p.id)}` }}>
          <p className="mb-2 text-sm font-semibold">{p.name}</p>
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {p.metrics.filter((m) => !(skipAuto && AUTO.has(m.id))).map((m) => (
              <label key={m.id} className="flex items-center justify-between gap-2 text-xs text-muted">
                {m.label}
                <input type="number" min={0} className={cx(field, 'w-20 shrink-0 text-right')} value={value[p.id]?.[m.id] ?? ''} placeholder="0"
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
  const [date, setDate] = useState(day(0));
  const saved = daily[`${me}|${date}`] ?? emptyDaily();
  const [plan, setPlan] = useState<DayBlock[]>(saved.plan);
  const [sodNote, setSodNote] = useState(saved.sodNote);
  const [sodTargets, setSodTargets] = useState<ProjectNumbers>(saved.sodTargets);
  const [eodNote, setEodNote] = useState(saved.eodNote);
  const [eodActuals, setEodActuals] = useState<ProjectNumbers>(saved.eodActuals);
  // Reload the form when switching person or date.
  useEffect(() => {
    const d = useStore.getState().daily[`${me}|${date}`] ?? emptyDaily();
    setPlan(d.plan); setSodNote(d.sodNote); setSodTargets(d.sodTargets); setEodNote(d.eodNote); setEodActuals(d.eodActuals);
  }, [me, date]);

  const myProjects = projects.filter((p) => p.status === 'active' && (p.pmId === me || p.teamIds.includes(me)));
  const openTasks = useMemo(() => tasks.filter((t) => t.assigneeId === me && (t.date === date || (t.date < date && t.status !== 'done'))), [tasks, me, date]);
  const plannedMin = plan.reduce((s, b) => s + (+b.end.slice(0, 2) * 60 + +b.end.slice(3) - (+b.start.slice(0, 2) * 60 + +b.start.slice(3))), 0);
  const isToday = date === day(0);
  const upd = (id: string, p: Partial<DayBlock>) => setPlan((x) => x.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const addCustom = () => {
    const last = [...plan].sort((a, b) => a.end.localeCompare(b.end)).at(-1)?.end ?? '10:00';
    if (last >= '19:00') return toast({ title: 'Your day is already planned up to 7pm — shorten a block first', tone: 'info' });
    const endIdx = Math.min(TIMES.length - 1, TIMES.indexOf(last) + 2);
    setPlan((x) => [...x, { id: `nb${++bid}`, start: last, end: TIMES[endIdx], projectId: '', taskIds: [], custom: { title: '', priority: true, targetQty: 0, unit: '' } }]);
  };
  const updC = (id: string, c: Partial<NonNullable<DayBlock['custom']>>) => setPlan((x) => x.map((b) => (b.id === id && b.custom ? { ...b, custom: { ...b.custom, ...c } } : b)));
  const addBlock = () => {
    const last = [...plan].sort((a, b) => a.end.localeCompare(b.end)).at(-1)?.end ?? '10:00';
    const endIdx = Math.min(TIMES.length - 1, TIMES.indexOf(last) + 4);
    if (last >= '19:00') return toast({ title: 'Your day is already planned up to 7pm', tone: 'info' });
    setPlan((x) => [...x, { id: `nb${++bid}`, start: last, end: TIMES[endIdx], projectId: myProjects[0]?.id ?? '', taskIds: [] }]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily update</h1>
          <p className="text-sm text-muted">Plan your day in the morning, report back in the evening. Working hours 10am – 7pm.</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          <button aria-label="Previous day" className="focus-ring rounded-lg p-1.5 hover:bg-surface-2" onClick={() => setDate(shift(date, -1))}><ChevronLeft size={16} /></button>
          <label className="flex items-center gap-2 px-1 text-sm font-semibold"><CalendarDays size={15} /><input type="date" className="bg-transparent outline-none" value={date} max={day(0)} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
          <button aria-label="Next day" disabled={isToday} className="focus-ring rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30" onClick={() => setDate(shift(date, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      <Card>
        <H2 right={<span className="text-xs text-muted">{fmtMin(plannedMin)} of 9h planned</span>}>Plan your day</H2>
        <DayTracker blocks={plan} loggedMinutes={openTasks.filter((t) => t.date === date && t.minutes).reduce((s, t) => s + (t.minutes ?? 0), 0)} />
        <div className="mt-5 space-y-3">
          {plan.length === 0 && <p className="text-sm text-muted">Split your day into blocks — one per project — and pick the tasks you'll do in each.</p>}
          {[...plan].sort((a, b) => a.start.localeCompare(b.start)).map((b) => {
            const projTasks = openTasks.filter((t) => t.projectId === b.projectId);
            if (b.custom) {
              const c = b.custom;
              return (
                <div key={b.id} className={cx('rounded-2xl border p-3', c.priority ? 'border-coral-strong/50 bg-coral/30' : 'border-line bg-surface-2')} style={{ borderLeft: `6px solid ${c.priority ? '#DC2626' : '#64748B'}` }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <select aria-label="Start" className={cx(field, 'w-24')} value={b.start} onChange={(e) => upd(b.id, { start: e.target.value })}>{TIMES.slice(0, -1).map((t) => <option key={t}>{t}</option>)}</select>
                    <span className="text-muted">→</span>
                    <select aria-label="End" className={cx(field, 'w-24')} value={b.end} onChange={(e) => upd(b.id, { end: e.target.value })}>{TIMES.slice(1).map((t) => <option key={t}>{t}</option>)}</select>
                    <input aria-label="Custom block title" className={cx(field, 'min-w-[200px] flex-1')} placeholder="What came up? e.g. Urgent client deck revision" value={c.title} onChange={(e) => updC(b.id, { title: e.target.value })} />
                    <button aria-pressed={c.priority} onClick={() => updC(b.id, { priority: !c.priority })} className={cx('focus-ring flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold', c.priority ? 'border-coral-strong bg-coral text-coral-ink' : 'border-line text-muted')}>
                      <Star size={12} fill={c.priority ? 'currentColor' : 'none'} /> Priority
                    </button>
                    <button aria-label="Remove block" className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface hover:text-coral-ink" onClick={() => setPlan((x) => x.filter((y) => y.id !== b.id))}><Trash2 size={15} /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-semibold">Target</span>
                    <input aria-label="Target quantity" type="number" min={0} className={cx(field, 'w-20 text-right')} value={c.targetQty || ''} placeholder="0" onChange={(e) => updC(b.id, { targetQty: Math.max(0, +e.target.value || 0) })} />
                    <input aria-label="Target unit" className={cx(field, 'w-40')} placeholder="unit, e.g. slides" value={c.unit} onChange={(e) => updC(b.id, { unit: e.target.value })} />
                    <span className="ml-2 font-semibold">For project</span>
                    <select aria-label="Custom block project" className={cx(field, 'w-56')} value={c.projectId ?? ''} onChange={(e) => updC(b.id, { projectId: e.target.value || undefined })}>
                      <option value="">— Not project-specific —</option>
                      {myProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    {saved.eodAt || !isToday ? null : <span className="ml-auto italic">Fill in what you achieved at end of day ↓</span>}
                  </div>
                </div>
              );
            }
            return (
              <div key={b.id} className="rounded-2xl border border-line p-3" style={{ borderLeft: `6px solid ${colorOf(projects, b.projectId)}` }}>
                <div className="flex flex-wrap items-center gap-2">
                  <select aria-label="Start" className={cx(field, 'w-24')} value={b.start} onChange={(e) => upd(b.id, { start: e.target.value })}>{TIMES.slice(0, -1).map((t) => <option key={t}>{t}</option>)}</select>
                  <span className="text-muted">→</span>
                  <select aria-label="End" className={cx(field, 'w-24')} value={b.end} onChange={(e) => upd(b.id, { end: e.target.value })}>{TIMES.slice(1).map((t) => <option key={t}>{t}</option>)}</select>
                  <select aria-label="Project" className={cx(field, 'min-w-[200px] flex-1')} value={b.projectId} onChange={(e) => upd(b.id, { projectId: e.target.value, taskIds: [] })}>
                    {myProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <button aria-label="Remove block" className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => setPlan((x) => x.filter((y) => y.id !== b.id))}><Trash2 size={15} /></button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {projTasks.length === 0 && <span className="text-xs text-muted">No open tasks on this project.</span>}
                  {projTasks.map((t) => {
                    const on = b.taskIds.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => upd(b.id, { taskIds: on ? b.taskIds.filter((x) => x !== t.id) : [...b.taskIds, t.id] })}
                        className={cx('focus-ring rounded-full border px-3 py-1 text-xs first-letter:uppercase', on ? 'border-accent bg-accent-soft font-semibold text-accent-ink' : 'border-line text-muted')}>
                        {on ? '✓ ' : ''}{t.title} · {fmtMin(t.targetMinutes)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn tone="soft" onClick={addBlock}><Plus size={14} /> Add time block</Btn>
          <Btn tone="soft" onClick={addCustom}><Star size={14} /> Add custom block</Btn>
          <Btn tone="ghost" className="border border-line" onClick={() => setPlan(defaultPlan(projects, me))}><Wand2 size={14} /> Fill from my project hours</Btn>
          <Btn className="ml-auto" onClick={() => safe(() => { saveDaily(me, date, { plan }); toast({ title: 'Day plan saved — it shows on your dashboard', tone: 'success' }); })}>Save plan</Btn>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <H2 right={saved.sodAt ? <Chip tone="mint">Set at {new Date(saved.sodAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Chip> : <Chip tone="butter">Not set yet</Chip>}>
            <Sunrise size={18} className="mr-1.5 inline text-butter-ink" /> Start of day
          </H2>
          <label className="text-sm font-semibold">What will you get done today?
            <textarea rows={2} className={cx(input, 'mt-1')} value={sodNote} onChange={(e) => setSodNote(e.target.value)} placeholder="e.g. Finish the QBR deck, then 30 personalised L1s" />
          </label>
          <p className="mb-2 mt-4 text-sm font-semibold">Today's targets</p>
          <NumbersGrid value={sodTargets} onChange={setSodTargets} />
          <Btn className="mt-4" onClick={() => safe(() => { saveDaily(me, date, { sodNote, sodTargets, sodAt: new Date().toISOString() }); toast({ title: "Today's targets set 🎯", tone: 'success' }); })}>Set today's targets</Btn>
        </Card>

        <Card>
          <H2 right={saved.eodAt ? <Chip tone="mint">Sent at {new Date(saved.eodAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Chip> : <Chip tone="butter">Not sent yet</Chip>}>
            <Moon size={18} className="mr-1.5 inline text-accent-ink" /> End of day
          </H2>
          <label className="text-sm font-semibold">How did today go?
            <textarea rows={2} className={cx(input, 'mt-1')} value={eodNote} onChange={(e) => setEodNote(e.target.value)} placeholder="Wins, blockers, what carries over to tomorrow" />
          </label>
          <p className="mb-1 mt-4 text-sm font-semibold">What you achieved</p>
          <p className="mb-2 text-xs text-muted">Messages and decks are counted automatically from your submitted tasks. These numbers add to your projects straight away.</p>
          {plan.some((b) => b.custom) && (
            <div className="mb-3 space-y-2">
              {plan.filter((b) => b.custom).map((b) => (
                <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3 text-sm" style={{ borderLeft: `5px solid ${b.custom!.priority ? '#DC2626' : '#64748B'}` }}>
                  <span className="min-w-0 flex-1"><b>{b.custom!.priority && '★ '}{b.custom!.title || 'Custom block'}</b><span className="block text-xs text-muted">{b.start}–{b.end} · target {b.custom!.targetQty || 0} {b.custom!.unit}</span></span>
                  <label className="flex items-center gap-1 text-xs text-muted">Achieved
                    <input type="number" min={0} className={cx(field, 'w-20 text-right')} value={b.custom!.achieved ?? ''} placeholder="0" onChange={(e) => updC(b.id, { achieved: Math.max(0, +e.target.value || 0) })} />
                  </label>
                  {b.custom!.targetQty > 0 && b.custom!.achieved != null && <Chip tone={b.custom!.achieved >= b.custom!.targetQty ? 'mint' : 'butter'}>{b.custom!.achieved >= b.custom!.targetQty ? '✓ Target met' : `${b.custom!.targetQty - b.custom!.achieved} short`}</Chip>}
                </div>
              ))}
            </div>
          )}
          <NumbersGrid value={eodActuals} onChange={setEodActuals} skipAuto />
          <Btn className="mt-4" onClick={() => safe(() => { saveDaily(me, date, { plan, eodNote, eodActuals, eodAt: new Date().toISOString() }); toast({ title: `End of day sent — nice work, ${first(me)} 🌙`, tone: 'success' }); })}>Send end-of-day update</Btn>
        </Card>
      </div>
    </div>
  );
}
