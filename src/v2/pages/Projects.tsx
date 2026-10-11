import { useState } from 'react';
import { CalendarPlus, Lock, Minus, Pencil, Plus, X } from 'lucide-react';
import { toast } from '@/components';
import { day, type Project } from '../data';
import { first, useStore } from '../store';
import { Btn, Card, PROJECT_COLORS, cx, input, safe } from '../ui';
import { ProjectSetup } from './ProjectSetup';
import { Timeline } from './Timeline';
import { ProjectBlock, TargetsTable } from './Widgets';

function TargetEditor({ p, period }: { p: Project; period: 'week' | 'month' }) {
  const { setTarget, setLock } = useStore();
  const key = period === 'week' ? 'weekTarget' : 'monthTarget';
  const locked = period === 'week' ? p.weekLocked : p.monthLocked;
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold">{period === 'week' ? 'Weekly' : 'Monthly'} targets</p>
        {locked ? (
          <Btn tone="ghost" className="border border-line" onClick={() => safe(() => setLock(p.id, period, false))}><Pencil size={13} /> Edit</Btn>
        ) : (
          <Btn onClick={() => safe(() => { setLock(p.id, period, true); toast({ title: `${period === 'week' ? 'Weekly' : 'Monthly'} targets locked — management can see them`, tone: 'success' }); })}><Lock size={13} /> Lock targets</Btn>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {p.metrics.map((m) => (
          <label key={m.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted">{m.label}</span>
            {locked ? (
              <b className="w-20 text-right">{(p[key][m.id] ?? 0)}</b>
            ) : (
              <input type="number" min={0} aria-label={`${m.label} ${period} target`} className={cx(input, 'w-20 py-1 text-right')} value={(p[key][m.id] ?? 0)} onChange={(e) => safe(() => setTarget(p.id, key, m.id, +e.target.value))} />
            )}
          </label>
        ))}
      </div>
      {!locked && <p className="mt-3 text-xs text-butter-ink">Not visible to management until you lock it.</p>}
    </div>
  );
}

/** Add, rename or remove the numbers this project tracks (e.g. drop tele calls, add connections). */
function MetricManager({ p }: { p: Project }) {
  const { addMetric, removeMetric, renameMetric } = useStore();
  const [label, setLabel] = useState('');
  const locked = p.weekLocked || p.monthLocked;
  return (
    <div className="rounded-2xl border border-line p-4">
      <p className="font-semibold">What this project tracks</p>
      <p className="mb-3 text-xs text-muted">Not every project needs every number. {locked ? 'Unlock the targets to add or remove items.' : 'Add, rename or remove items.'}</p>
      <ul className="flex flex-wrap gap-2">
        {p.metrics.map((m) => (
          <li key={m.id} className="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-1 pl-3 pr-1 text-sm">
            <input aria-label={`Rename ${m.label}`} className="w-36 bg-transparent outline-none focus:underline" defaultValue={m.label} onBlur={(e) => e.target.value !== m.label && safe(() => renameMetric(p.id, m.id, e.target.value))} />
            <button aria-label={`Remove ${m.label}`} disabled={locked} className="focus-ring rounded-full p-1 text-muted hover:bg-line disabled:opacity-40" onClick={() => safe(() => removeMetric(p.id, m.id))}><X size={13} /></button>
          </li>
        ))}
      </ul>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (safe(() => addMetric(p.id, label))) setLabel(''); }}>
        <input className={input} placeholder="Add a number to track, e.g. Connections accepted" value={label} disabled={locked} onChange={(e) => setLabel(e.target.value)} />
        <Btn type="submit" disabled={locked}><Plus size={14} /> Add</Btn>
      </form>
    </div>
  );
}

function OwnedProject({ p, color }: { p: Project; color: string }) {
  const { bump, addMeeting, postUpdate } = useStore();
  const [m, setM] = useState({ company: '', contact: '', date: day(1), time: '11:00' });
  const [update, setUpdate] = useState('');
  return (
    <ProjectBlock color={color} title={p.name} meta="You own this project">
      <div className="space-y-5 p-4">
        {p.description && <p className="text-sm text-muted">{p.description}</p>}
        <Timeline project={p} />
        <MetricManager p={p} />
        <div className="grid gap-4 lg:grid-cols-2">
          <TargetEditor p={p} period="week" />
          <TargetEditor p={p} period="month" />
        </div>

        <div className="rounded-2xl border border-line p-4">
          <p className="mb-3 font-semibold">Progress against targets</p>
          <TargetsTable p={p} />
        </div>

        <div className="rounded-2xl border border-line p-4">
          <p className="mb-3 font-semibold">Update this week's numbers</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {p.metrics.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted">{x.label}</span>
                <span className="flex items-center gap-1">
                  <button aria-label={`Minus ${x.label}`} className="focus-ring rounded-lg border border-line p-1 hover:bg-surface-2" onClick={() => safe(() => bump(p.id, x.id, -1))}><Minus size={13} /></button>
                  <b className="w-16 text-center">{(p.week[x.id] ?? 0)}{p.weekLocked && <span className="font-normal text-muted">/{(p.weekTarget[x.id] ?? 0)}</span>}</b>
                  <button aria-label={`Plus ${x.label}`} className="focus-ring rounded-lg border border-line p-1 hover:bg-surface-2" onClick={() => safe(() => bump(p.id, x.id, 1))}><Plus size={13} /></button>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line p-4">
          <p className="mb-3 font-semibold">Meetings</p>
          <form
            className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              if (safe(() => addMeeting(p.id, m))) {
                toast({ title: `Meeting with ${m.company} scheduled`, tone: 'success' });
                setM({ ...m, company: '', contact: '' });
              }
            }}
          >
            <input className={input} placeholder="Company" value={m.company} onChange={(e) => setM({ ...m, company: e.target.value })} />
            <input className={input} placeholder="Contact (name, role)" value={m.contact} onChange={(e) => setM({ ...m, contact: e.target.value })} />
            <input type="date" className={input} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} />
            <input type="time" className={input} value={m.time} onChange={(e) => setM({ ...m, time: e.target.value })} />
            <Btn type="submit"><CalendarPlus size={14} /> Schedule</Btn>
          </form>
          <ul className="mt-3 divide-y divide-line text-sm">
            {p.meetings.length === 0 && <li className="py-2 text-muted">No meetings yet.</li>}
            {p.meetings.map((x) => (
              <li key={x.id} className="flex justify-between py-2"><span><b>{x.company}</b> <span className="text-muted">· {x.contact}</span></span><span className="text-muted">{x.date} {x.time}</span></li>
            ))}
          </ul>
        </div>

        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (safe(() => postUpdate(p.id, update))) { setUpdate(''); toast({ title: 'Update posted', tone: 'success' }); } }}>
          <input className={input} placeholder="Post a project update for the team…" value={update} onChange={(e) => setUpdate(e.target.value)} />
          <Btn type="submit">Post</Btn>
        </form>
        {p.updates.slice(0, 3).map((u) => <p key={u.id} className="text-sm text-muted">📌 {u.text} <span className="text-xs">— {first(u.by)}</span></p>)}
      </div>
    </ProjectBlock>
  );
}

export default function Projects() {
  const { me, projects } = useStore();
  const [proposeOpen, setProposeOpen] = useState(false);
  const mine = projects.map((p, i) => ({ p, color: PROJECT_COLORS[i % PROJECT_COLORS.length] })).filter(({ p }) => p.pmId === me || p.teamIds.includes(me));

  return (
    <div className="space-y-6">
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
          <ProjectBlock key={p.id} color={color} title={p.name} meta={`PM ${first(p.pmId)} · your hours: ${p.hours[me] ?? 0}h/day`}>
            <div className="space-y-4 p-4">
              {p.description && <p className="text-sm text-muted">{p.description}</p>}
              <Timeline project={p} />
              <TargetsTable p={p} />
            </div>
          </ProjectBlock>
        ),
      )}
      <ProjectSetup open={proposeOpen} onClose={() => setProposeOpen(false)} />
    </div>
  );
}
