import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import { Btn, Card, PROJECT_COLORS } from '../ui';
import { ProjectSetup } from './ProjectSetup';
import { ProjectCard } from './Projects';

/**
 * Management view of every active project: progress as a bar-chart list against each week's planned targets,
 * plus the same Targets / This week's numbers / Meetings tabs the owner has (managers and founders can edit them).
 */
export default function LeadProjects() {
  const projects = useStore((s) => s.projects);
  const [open, setOpen] = useState(false);
  const active = projects.map((p, i) => ({ p, color: PROJECT_COLORS[i % PROJECT_COLORS.length] })).filter(({ p }) => p.status === 'active');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Btn onClick={() => setOpen(true)}><Plus size={14} /> Onboard a project</Btn>
      </div>
      {active.map(({ p, color }) => <ProjectCard key={p.id} p={p} color={color} />)}
      {active.length === 0 && <Card><p className="py-6 text-center text-muted">No active projects yet.</p></Card>}
      <ProjectSetup open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
