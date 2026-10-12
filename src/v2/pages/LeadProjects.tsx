import { useState } from 'react';
import { Plus } from 'lucide-react';
import { nameOf, useStore } from '../store';
import { Avatar, Btn, Card, PROJECT_COLORS } from '../ui';
import { ProjectSetup } from './ProjectSetup';
import { Timeline } from './Timeline';
import { TargetsTable } from './Widgets';
import { ProjectHero } from './Projects';

/** Management view of every project: live numbers from the PM's updates against locked targets. Read-only. */
export default function LeadProjects() {
  const projects = useStore((s) => s.projects);
  const [open, setOpen] = useState(false);
  const active = projects.filter((p) => p.status === 'active');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Btn onClick={() => setOpen(true)}><Plus size={14} /> Onboard a project</Btn>
      </div>
      {active.map((p, i) => (
        <div key={p.id} className="overflow-hidden rounded-card bg-surface shadow-soft">
          <ProjectHero p={p} color={PROJECT_COLORS[i % PROJECT_COLORS.length]} owner={false} />
          <div className="grid gap-6 p-5 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4"><Timeline project={p} /><TargetsTable p={p} /></div>
            <div className="space-y-4 text-sm">
              <div className="rounded-2xl border border-line p-3">
                <p className="mb-2 text-xs font-bold uppercase text-muted">Team</p>
                <ul className="space-y-1.5">
                  {p.teamIds.map((id) => <li key={id} className="flex items-center gap-2"><Avatar id={id} size="sm" />{nameOf(id)}<span className="ml-auto text-xs text-muted">{p.hours[id] ?? 0}h/day</span></li>)}
                </ul>
              </div>
              <div className="rounded-2xl border border-line p-3">
                <p className="mb-2 text-xs font-bold uppercase text-muted">Upcoming meetings</p>
                {p.meetings.length === 0 ? <p className="text-muted">None scheduled.</p> : p.meetings.map((m) => <p key={m.id} className="flex justify-between"><b>{m.company}</b> <span className="text-muted">{m.date} {m.time}</span></p>)}
              </div>
            </div>
          </div>
        </div>
      ))}
      {active.length === 0 && <Card><p className="py-6 text-center text-muted">No active projects yet.</p></Card>}
      <ProjectSetup open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
