import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PEOPLE } from '../data';
import { first, useStore } from '../store';
import { Avatar, Btn, Card, Chip, PROJECT_COLORS } from '../ui';
import { ProjectSetup } from './ProjectSetup';
import { Timeline } from './Timeline';
import { ProjectBlock, TargetsTable } from './Widgets';

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
        <ProjectBlock key={p.id} color={PROJECT_COLORS[i % PROJECT_COLORS.length]} title={p.name} meta={`${p.client} · PM ${first(p.pmId)}`}>
          <div className="space-y-5 p-4">
            {p.description && <p className="text-sm text-muted">{p.description}</p>}
            <Timeline project={p} />
            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
              <div>
                
                <TargetsTable p={p} />
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="mb-1.5 font-semibold">Team</p>
                  <ul className="space-y-1.5">
                    {p.teamIds.map((id) => <li key={id} className="flex items-center gap-2"><Avatar id={id} size="sm" />{PEOPLE.find((x) => x.id === id)?.name}<span className="ml-auto text-xs text-muted">{p.hours[id] ?? 0}h/day</span></li>)}
                  </ul>
                </div>
                <div>
                  <p className="mb-1.5 font-semibold">Meetings</p>
                  {p.meetings.length === 0 ? <p className="text-muted">None scheduled.</p> : p.meetings.map((m) => <p key={m.id}><b>{m.company}</b> <span className="text-muted">{m.date} {m.time}</span></p>)}
                </div>
                {p.updates[0] && <Chip tone="sky">📌 {p.updates[0].text}</Chip>}
              </div>
            </div>
          </div>
        </ProjectBlock>
      ))}
      {active.length === 0 && <Card><p className="py-6 text-center text-muted">No active projects yet.</p></Card>}
      <ProjectSetup open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
