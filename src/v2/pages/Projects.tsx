import { useState } from 'react';
import { CalendarPlus, Lock, Pencil, Plus, Settings2, X } from 'lucide-react';
import { toast } from '@/components';
import { day, DEFAULT_STANDARDS, inPeriod, weekStart, type Project } from '../data';
import { first, projectCounts, useStore } from '../store';
import { Btn, Card, PROJECT_COLORS, cx, input, safe } from '../ui';
import { ProjectSetup } from './ProjectSetup';
import { Timeline } from './Timeline';
import { ProjectBlock, TargetsTable } from './Widgets';

function TargetEditor({ p, period }: { p: Project; period: 'week' | 'month' }) {
  const { setTarget, setLock } = useStore();
  const key = period === 'week' ? 'weekTarget' : 'monthTarget';
  const locked = period === 'week' ? p.weekLocked : p.monthLocked;
  return (
    <div className={cx('rounded-2xl border-2 p-4', locked ? 'border-mint-strong/50 bg-mint/20' : 'border-dashed border-butter-strong/60 bg-butter/20')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-bold">{period === 'week' ? '📅 Weekly' : '🗓️ Monthly'} targets</p>
          <p className="text-xs text-muted">{locked ? 'Locked — visible to everyone on the project and management' : 'Draft — only you can see these until you lock them'}</p>
        </div>
        {locked ? (
          <Btn tone="ghost" className="border border-line bg-surface" onClick={() => safe(() => setLock(p.id, period, false))}><Pencil size={13} /> Edit</Btn>
        ) : (
          <Btn onClick={() => safe(() => { setLock(p.id, period, true); toast({ title: `${period === 'week' ? 'Weekly' : 'Monthly'} targets locked — management can see them`, tone: 'success' }); })}><Lock size={13} /> Lock targets</Btn>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {p.metrics.filter((m) => inPeriod(m, period)).map((m) => (
          <label key={m.id} className="rounded-xl border border-line bg-surface px-3 py-2">
            <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-muted">{m.label}</span>
            {locked ? (
              <span className="block text-xl font-extrabold">{p[key][m.id] ?? 0}</span>
            ) : (
              <input type="number" min={0} aria-label={`${m.label} ${period} target`} className="w-full bg-transparent text-xl font-extrabold outline-none focus:underline" value={p[key][m.id] ?? 0} onChange={(e) => safe(() => setTarget(p.id, key, m.id, +e.target.value))} />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Add, rename or remove the numbers this project tracks (e.g. drop tele calls, add connections). */
function MetricManager({ p }: { p: Project }) {
  const { addMetric, removeMetric, renameMetric, setMetricPeriods } = useStore();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState('');
  const [periods, setPeriods] = useState<('week' | 'month')[]>(['week', 'month']);
  const tag = (m: Project['metrics'][number]) => (!m.periods || m.periods.length === 2 ? 'Weekly + monthly' : m.periods[0] === 'week' ? 'Weekly only' : 'Monthly only');
  const toggle = (list: ('week' | 'month')[], x: 'week' | 'month') => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold">What this project tracks</p>
          <p className="text-xs text-muted">Choose the numbers, and whether each has a weekly target, a monthly target, or both.</p>
        </div>
        <Btn tone={editing ? 'primary' : 'ghost'} className="border border-line" onClick={() => setEditing((v) => !v)}><Pencil size={13} /> {editing ? 'Done' : 'Edit'}</Btn>
      </div>
      {!editing ? (
        <ul className="flex flex-wrap gap-2">
          {p.metrics.map((m) => <li key={m.id} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm">{m.label} <span className="text-xs text-muted">· {tag(m)}</span></li>)}
        </ul>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {p.metrics.map((m) => {
              const cur = m.periods ?? ['week', 'month'];
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <input aria-label={`Rename ${m.label}`} className={cx(input, 'max-w-[240px] flex-1 py-1')} defaultValue={m.label} onBlur={(e) => e.target.value !== m.label && safe(() => renameMetric(p.id, m.id, e.target.value))} />
                  {(['week', 'month'] as const).map((x) => (
                    <label key={x} className="flex items-center gap-1 text-xs text-muted">
                      <input type="checkbox" checked={cur.includes(x)} onChange={() => safe(() => setMetricPeriods(p.id, m.id, toggle(cur, x)))} /> {x === 'week' ? 'Weekly' : 'Monthly'}
                    </label>
                  ))}
                  <button aria-label={`Remove ${m.label}`} className="focus-ring ml-auto rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => safe(() => removeMetric(p.id, m.id))}><X size={14} /></button>
                </li>
              );
            })}
          </ul>
          <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (safe(() => addMetric(p.id, label, periods))) { setLabel(''); toast({ title: 'Now tracking it', tone: 'success' }); } }}>
            <input className={cx(input, 'min-w-[220px] flex-1')} placeholder="New number, e.g. Connections accepted" value={label} onChange={(e) => setLabel(e.target.value)} />
            {(['week', 'month'] as const).map((x) => (
              <label key={x} className="flex items-center gap-1 text-xs text-muted"><input type="checkbox" checked={periods.includes(x)} onChange={() => setPeriods((v) => toggle(v, x))} /> {x === 'week' ? 'Weekly' : 'Monthly'}</label>
            ))}
            <Btn type="submit"><Plus size={14} /> Add</Btn>
          </form>
        </>
      )}
    </div>
  );
}

/** This week's numbers: filled automatically from submitted tasks and end-of-day updates. Type the real number to correct it. */
function WeekNumbers({ p }: { p: Project }) {
  const { tasks, daily, setWeekValue } = useStore();
  const { counts, auto } = projectCounts(p, tasks, daily, { kind: 'week', key: weekStart(0) });
  return (
    <div>
      <p className="mb-3 text-sm text-muted">These fill in automatically from submitted tasks and everyone's end-of-day updates. If something wasn't logged, just type the correct total.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {p.metrics.filter((m) => inPeriod(m, 'week')).map((x) => {
          const a = auto[x.id] ?? 0;
          const t = p.weekLocked ? p.weekTarget[x.id] : undefined;
          return (
            <label key={x.id} className="rounded-2xl border border-line bg-surface p-3 shadow-soft">
              <span className="block truncate text-[11px] font-bold uppercase tracking-wide text-muted">{x.label}</span>
              <span className="mt-1 flex items-baseline gap-1">
                <input type="number" min={a} aria-label={`${x.label} this week`} className="w-24 rounded-lg border border-line bg-surface-2 px-2 py-1 text-xl font-extrabold outline-none focus:border-accent"
                  value={counts[x.id] ?? 0} onChange={(e) => safe(() => setWeekValue(p.id, x.id, Math.max(0, (+e.target.value || 0) - a)))} />
                {t ? <span className="text-sm text-muted">/ {t}</span> : null}
              </span>
              {a > 0 && <span className="mt-1 block text-[10px] text-accent-ink">{a} auto-counted</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** Coloured project header with key facts. */
export function ProjectHero({ p, color, owner, onEdit }: { p: Project; color: string; owner: boolean; onEdit?: () => void }) {
  const me = useStore((s) => s.me);
  const days = Math.max(0, Math.round((new Date(p.endDate + 'T00:00').getTime() - Date.now()) / 86_400_000));
  const st = { ...DEFAULT_STANDARDS, ...p.standards };
  return (
    <div className="relative overflow-hidden rounded-t-card p-5 text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc 60%, #0B1B4D)` }}>
      <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">{p.client} · {owner ? 'You own this project' : `PM ${first(p.pmId)}`}</p>
          <h2 className="text-2xl font-extrabold text-white">{p.name}</h2>
          {p.description && <p className="mt-1 max-w-2xl text-sm text-white/85">{p.description}</p>}
        </div>
        {owner && onEdit && <Btn tone="ghost" className="border border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={onEdit}><Settings2 size={14} /> Edit project details</Btn>}
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['⏳', `${days} days`, 'left on the project'],
          ['👥', `${p.teamIds.length} people`, owner ? 'on the team' : `you: ${p.hours[me] ?? 0}h / day`],
          ['🤝', `${p.month.meetings ?? 0} meetings`, 'booked this month'],
          ['⏱️', `${st.prospect} / ${st.l1} / ${st.l2} min`, 'prospect · L1 · L2 standard'],
        ].map(([i, v, l]) => (
          <div key={l} className="rounded-xl bg-white/15 px-3 py-2 backdrop-blur"><p className="text-sm font-extrabold">{i} {v}</p><p className="text-[11px] text-white/75">{l}</p></div>
        ))}
      </div>
    </div>
  );
}

type Tab = 'progress' | 'targets' | 'numbers' | 'meetings';

function OwnedProject({ p, color }: { p: Project; color: string }) {
  const { addMeeting } = useStore();
  const [m, setM] = useState({ company: '', contact: '', date: day(1), time: '11:00' });
  const [tab, setTab] = useState<Tab>('progress');
  const [editOpen, setEditOpen] = useState(false);
  const tabs: [Tab, string][] = [['progress', '📈 Progress'], ['targets', '🎯 Targets'], ['numbers', "✍️ This week's numbers"], ['meetings', `🤝 Meetings (${p.meetings.length})`]];
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-soft">
      <ProjectHero p={p} color={color} owner onEdit={() => setEditOpen(true)} />
      <div className="flex flex-wrap gap-1 border-b border-line px-4 pt-3" role="tablist">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('focus-ring -mb-px rounded-t-xl border-b-2 px-4 py-2 text-sm font-semibold', tab === k ? 'border-accent text-accent-ink' : 'border-transparent text-muted hover:text-ink')}>{l}</button>
        ))}
      </div>
      <div className="space-y-5 p-5">
        {tab === 'progress' && <><Timeline project={p} /><TargetsTable p={p} /></>}
        {tab === 'targets' && <>
          <MetricManager p={p} />
          <div className="grid gap-4 lg:grid-cols-2"><TargetEditor p={p} period="week" /><TargetEditor p={p} period="month" /></div>
        </>}
        {tab === 'numbers' && <WeekNumbers p={p} />}
        {tab === 'meetings' && <>
          <form className="grid gap-2 rounded-2xl bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto_auto_auto]" onSubmit={(e) => {
            e.preventDefault();
            if (safe(() => addMeeting(p.id, m))) { toast({ title: `Meeting with ${m.company} scheduled`, tone: 'success' }); setM({ ...m, company: '', contact: '' }); }
          }}>
            <input className={input} placeholder="Company" value={m.company} onChange={(e) => setM({ ...m, company: e.target.value })} />
            <input className={input} placeholder="Contact (name, role)" value={m.contact} onChange={(e) => setM({ ...m, contact: e.target.value })} />
            <input type="date" className={input} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
            <input type="time" className={input} value={m.time} onChange={(e) => setM({ ...m, time: e.target.value })} />
            <Btn type="submit"><CalendarPlus size={14} /> Schedule</Btn>
          </form>
          <div className="grid gap-2 sm:grid-cols-2">
            {p.meetings.length === 0 && <p className="text-sm text-muted">No meetings yet.</p>}
            {p.meetings.map((x) => (
              <div key={x.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <span className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-accent-soft text-accent-ink"><b className="text-sm leading-none">{new Date(x.date + 'T00:00').getDate()}</b><span className="text-[10px] uppercase">{new Date(x.date + 'T00:00').toLocaleDateString(undefined, { month: 'short' })}</span></span>
                <span className="min-w-0 flex-1 text-sm"><b>{x.company}</b><span className="block text-xs text-muted">{x.contact} · {x.time}</span></span>
              </div>
            ))}
          </div>
        </>}
      </div>
      <ProjectSetup open={editOpen} onClose={() => setEditOpen(false)} edit={p} />
    </div>
  );
}

export default function Projects() {
  const { me, projects } = useStore();
  const [proposeOpen, setProposeOpen] = useState(false);
  const mine = projects.map((p, i) => ({ p, color: PROJECT_COLORS[i % PROJECT_COLORS.length] })).filter(({ p }) => p.pmId === me || p.teamIds.includes(me));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Btn onClick={() => setProposeOpen(true)}><Plus size={14} /> Propose a project</Btn>
      </div>
      {mine.length === 0 && <Card><p className="py-6 text-center text-muted">You're not on any project yet.</p></Card>}
      {mine.map(({ p, color }) =>
        p.status === 'pending' ? (
          <ProjectBlock key={p.id} color="#94A3B8" title={p.name} meta="Waiting for management approval">
            <p className="p-4 text-sm text-muted">{p.description || 'No description'} · Once approved you can set targets and assign tasks.</p>
          </ProjectBlock>
        ) : p.pmId === me ? (
          <OwnedProject key={p.id} p={p} color={color} />
        ) : (
          <div key={p.id} className="overflow-hidden rounded-card bg-surface shadow-soft">
            <ProjectHero p={p} color={color} owner={false} />
            <div className="space-y-5 p-5"><Timeline project={p} /><TargetsTable p={p} /></div>
          </div>
        ),
      )}
      <ProjectSetup open={proposeOpen} onClose={() => setProposeOpen(false)} />
    </div>
  );
}
