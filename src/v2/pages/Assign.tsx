import { useState } from 'react';
import { Minus, Plus, Send, Star } from 'lucide-react';
import { toast } from '@/components';
import { METRICS, PEOPLE, TASK_TYPES, stdMinutes } from '../data';
import { first, useStore } from '../store';
import { Avatar, Bar, Btn, Card, Chip, H2, STATUS, cx, fmtMin, input, safe } from '../ui';

export default function Assign() {
  const { me, tasks, projects, assign, setTarget, bump, postUpdate } = useStore();
  const role = PEOPLE.find((p) => p.id === me)!.role;
  const isLead = role === 'manager' || role === 'founder';
  const myProjects = isLead ? projects : projects.filter((p) => p.pmId === me);

  const [projectId, setProjectId] = useState(myProjects[0]?.id ?? projects[0].id);
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  // PMs assign to their project team; managers/founders can give tasks to anyone, including PMs.
  const people = PEOPLE.filter((p) => p.id !== me && (isLead ? p.role !== 'founder' : project.teamIds.includes(p.id)));
  const [assigneeId, setAssigneeId] = useState(people[0]?.id ?? '');
  const [typeId, setTypeId] = useState('l1');
  const [variant, setVariant] = useState('Personalised');
  const [qty, setQty] = useState(30);
  const [title, setTitle] = useState('');
  const [update, setUpdate] = useState('');
  const type = TASK_TYPES.find((t) => t.id === typeId)!;
  const assignee = people.some((p) => p.id === assigneeId) ? assigneeId : people[0]?.id;
  const assigned = tasks.filter((t) => t.assignedById === me).slice(0, 8);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Assign tasks</h1>

      <Card>
        <H2>New task</H2>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase text-muted">Project</p>
            <div className="flex flex-wrap gap-2">
              {(isLead ? projects : myProjects).map((p) => (
                <Btn key={p.id} tone={p.id === projectId ? 'primary' : 'ghost'} className="border border-line" onClick={() => setProjectId(p.id)}>{p.name}</Btn>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase text-muted">Assign to</p>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setAssigneeId(p.id)}
                  className={cx('focus-ring flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm', p.id === assignee ? 'border-accent bg-accent-soft font-semibold' : 'border-line')}
                >
                  <Avatar id={p.id} size="sm" /> {p.name.split(' ')[0]}
                  <span className="text-xs text-muted">{p.title}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase text-muted">Task</p>
            <div className="flex flex-wrap gap-2">
              {TASK_TYPES.map((t) => (
                <Btn key={t.id} tone={t.id === typeId ? 'primary' : 'ghost'} className="border border-line" onClick={() => { setTypeId(t.id); setQty(t.id === 'deck' ? 1 : t.id === 'model' ? 10 : 30); }}>{t.name}</Btn>
              ))}
            </div>
            {type.variants && (
              <div className="mt-2 flex flex-wrap gap-2">
                {type.variants.map((v) => (
                  <Btn key={v} tone={v === variant ? 'soft' : 'ghost'} onClick={() => setVariant(v)}>{v}</Btn>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-semibold">
              Quantity
              <input type="number" min={1} className={cx(input, 'mt-1 w-28')} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value))} />
            </label>
            <label className="min-w-[200px] flex-1 text-sm font-semibold">
              Title (optional)
              <input className={cx(input, 'mt-1')} placeholder="e.g. Northwind QBR deck" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {isLead && <Chip tone="coral"><Star size={12} /> Sent as priority</Chip>}
          </div>
          <p className="text-sm text-muted">
            Ideal pace {type.ideal} → target <b className="text-ink">{fmtMin(stdMinutes({ typeId, variant: type.variants ? variant : undefined }, qty))}</b> · reviewed by you
          </p>
          <Btn
            disabled={!assignee}
            onClick={() => {
              if (safe(() => assign({ typeId, variant: type.variants ? variant : undefined, qty, projectId, assigneeId: assignee ?? '', reviewerId: me, priority: isLead, title }))) {
                toast({ title: `Task sent to ${first(assignee!)}`, tone: 'success' });
                setTitle('');
              }
            }}
          >
            <Send size={14} /> Assign
          </Btn>
        </div>
      </Card>

      <Card>
        <H2>Targets & numbers · {project.name}</H2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr><th className="py-2">Metric</th><th>This week</th><th className="w-40">Progress</th><th>Week target</th><th>Month</th><th>Month target</th></tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m.id} className="border-t border-line">
                  <td className="py-2 font-semibold">{m.label}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button aria-label={`Minus ${m.label}`} className="focus-ring rounded-lg p-1 hover:bg-surface-2" onClick={() => bump(project.id, m.id, -1)}><Minus size={14} /></button>
                      <span className="w-10 text-center font-bold">{project.week[m.id]}</span>
                      <button aria-label={`Plus ${m.label}`} className="focus-ring rounded-lg p-1 hover:bg-surface-2" onClick={() => bump(project.id, m.id, 1)}><Plus size={14} /></button>
                    </div>
                  </td>
                  <td className="pr-4"><Bar value={project.week[m.id]} max={project.weekTarget[m.id]} /></td>
                  <td><input aria-label={`${m.label} week target`} type="number" className={cx(input, 'w-20 py-1')} value={project.weekTarget[m.id]} onChange={(e) => setTarget(project.id, 'weekTarget', m.id, +e.target.value)} /></td>
                  <td className="font-semibold">{project.month[m.id]}</td>
                  <td><input aria-label={`${m.label} month target`} type="number" className={cx(input, 'w-24 py-1')} value={project.monthTarget[m.id]} onChange={(e) => setTarget(project.id, 'monthTarget', m.id, +e.target.value)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!update.trim()) return;
            postUpdate(project.id, update.trim());
            setUpdate('');
            toast({ title: 'Project update posted', tone: 'success' });
          }}
        >
          <input className={input} placeholder="Post a project update for the team…" value={update} onChange={(e) => setUpdate(e.target.value)} />
          <Btn type="submit">Post</Btn>
        </form>
        {project.updates.slice(0, 3).map((u) => (
          <p key={u.id} className="mt-2 text-sm text-muted">📌 {u.text} <span className="text-xs">— {first(u.by)}</span></p>
        ))}
      </Card>

      <Card>
        <H2>Tasks you assigned</H2>
        {assigned.length === 0 ? (
          <p className="text-sm text-muted">Nothing assigned yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {assigned.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                <Avatar id={t.assigneeId} size="sm" />
                <span className="flex-1 capitalize">{t.title}</span>
                {t.priority && <Chip tone="peach">Priority</Chip>}
                <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
