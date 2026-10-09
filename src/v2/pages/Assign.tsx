import { useEffect, useState } from 'react';
import { BellRing, Pencil, Send, Star } from 'lucide-react';
import { toast } from '@/components';
import { isLeadRole, PEOPLE, TASK_TYPES, targetFor, type Task } from '../data';
import { first, useStore } from '../store';
import { Avatar, Btn, Card, Chip, H2, STATUS, cx, fmtMin, input, safe } from '../ui';

function AssignedRow({ t }: { t: Task }) {
  const { projects, editTask, remind } = useStore();
  const [edit, setEdit] = useState(false);
  const [qty, setQty] = useState(t.qty);
  const [target, setTarget] = useState(t.targetMinutes);
  const [title, setTitle] = useState(t.title);
  const open = t.status !== 'done' && t.status !== 'in_review';
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Avatar id={t.assigneeId} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold first-letter:uppercase">{t.title} {t.priority && <Chip tone="coral"><Star size={11} /> Priority</Chip>}</p>
          <p className="text-xs text-muted">{first(t.assigneeId)} · {projects.find((p) => p.id === t.projectId)?.name} · target {fmtMin(t.targetMinutes)}{t.reminders > 0 && ` · reminded ${t.reminders}×`}</p>
        </div>
        <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
        {open && (
          <Btn tone="ghost" className="border border-line" onClick={() => safe(() => { remind(t.id); toast({ title: `Reminder sent to ${first(t.assigneeId)}`, tone: 'info' }); })}>
            <BellRing size={13} /> Remind
          </Btn>
        )}
        {t.status !== 'done' && <Btn tone="ghost" className="border border-line" onClick={() => setEdit((v) => !v)}><Pencil size={13} /> Edit</Btn>}
      </div>
      {edit && (
        <form
          className="ml-10 mt-2 grid gap-2 sm:grid-cols-[1fr_100px_120px_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            if (safe(() => editTask(t.id, { qty, targetMinutes: target, title }))) {
              setEdit(false);
              toast({ title: 'Task updated', tone: 'success' });
            }
          }}
        >
          <input aria-label="Title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
          <input aria-label="Quantity" type="number" min={1} className={input} value={qty} onChange={(e) => setQty(+e.target.value)} />
          <input aria-label="Target minutes" type="number" min={1} className={input} value={target} onChange={(e) => setTarget(+e.target.value)} />
          <Btn type="submit">Save</Btn>
        </form>
      )}
    </li>
  );
}

export default function Assign() {
  const { me, tasks, projects, assign } = useStore();
  const lead = isLeadRole(PEOPLE.find((p) => p.id === me)?.role);
  const choices = projects.filter((p) => p.status === 'active' && (lead || p.pmId === me));
  const [projectId, setProjectId] = useState(choices[0]?.id ?? '');
  const project = choices.find((p) => p.id === projectId) ?? choices[0];
  const people = PEOPLE.filter((p) => p.id !== me && p.role !== 'founder' && (lead || project?.teamIds.includes(p.id)));
  const [assigneeId, setAssigneeId] = useState('');
  const [typeId, setTypeId] = useState('l1');
  const [variant, setVariant] = useState('Personalised');
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [qty, setQty] = useState(30);
  const [target, setTarget] = useState(60);
  const [targetEdited, setTargetEdited] = useState(false);
  const [title, setTitle] = useState('');
  const type = TASK_TYPES.find((t) => t.id === typeId);
  const assignee = people.some((p) => p.id === assigneeId) ? assigneeId : people[0]?.id;
  const auto = type ? targetFor(typeId, qty, type.variants ? variant : undefined) : target;
  useEffect(() => { if (!targetEdited && type) setTarget(auto); }, [auto, targetEdited, type]);
  const assigned = tasks.filter((t) => t.assignedById === me);

  if (!project) return <Card><p className="py-8 text-center text-muted">You'll be able to assign tasks once you own an approved project.</p></Card>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Assign tasks</h1>
      <Card>
        <H2>New task</H2>
        <div className="space-y-5">
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase text-muted">Project</p>
            <div className="flex flex-wrap gap-2">
              {choices.map((p) => <Btn key={p.id} tone={p.id === project.id ? 'primary' : 'ghost'} className="border border-line" onClick={() => setProjectId(p.id)}>{p.name}</Btn>)}
            </div>
            {project.description && <p className="mt-2 rounded-xl bg-surface-2 p-3 text-sm text-muted">{project.description}</p>}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase text-muted">Assign to</p>
            <div className="flex flex-wrap gap-2">
              {people.length === 0 && <p className="text-sm text-muted">No teammates on this project yet.</p>}
              {people.map((p) => (
                <button key={p.id} onClick={() => setAssigneeId(p.id)} className={cx('focus-ring flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm', p.id === assignee ? 'border-accent bg-accent-soft font-semibold' : 'border-line')}>
                  <Avatar id={p.id} size="sm" /> {first(p.id)} <span className="text-xs text-muted">{p.title}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase text-muted">Task</p>
            <div className="flex flex-wrap gap-2">
              {TASK_TYPES.map((t) => (
                <Btn key={t.id} tone={t.id === typeId ? 'primary' : 'ghost'} className="border border-line" onClick={() => { setTypeId(t.id); setTargetEdited(false); setQty(t.id === 'deck' ? 1 : t.id === 'model' ? 10 : 30); }}>{t.name}</Btn>
              ))}
              <Btn tone={typeId === 'custom' ? 'primary' : 'ghost'} className="border border-dashed border-line" onClick={() => { setTypeId('custom'); setTargetEdited(true); }}>+ Custom task</Btn>
            </div>
            {type?.variants && (
              <div className="mt-2 flex flex-wrap gap-2">{type.variants.map((v) => <Btn key={v} tone={v === variant ? 'soft' : 'ghost'} onClick={() => { setVariant(v); setTargetEdited(false); }}>{v}</Btn>)}</div>
            )}
            {typeId === 'custom' && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input className={input} placeholder="Task name, e.g. LinkedIn profile audit" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                <input className={input} placeholder="Unit, e.g. profiles" value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm font-semibold">Quantity<input type="number" min={1} className={cx(input, 'mt-1 w-28')} value={qty} onChange={(e) => setQty(+e.target.value)} /></label>
            <label className="text-sm font-semibold">
              Target time (min)
              <input type="number" min={1} className={cx(input, 'mt-1 w-32')} value={target} onChange={(e) => { setTarget(+e.target.value); setTargetEdited(true); }} />
            </label>
            {type && targetEdited && <Btn tone="ghost" onClick={() => setTargetEdited(false)}>Reset to {fmtMin(auto)}</Btn>}
            <label className="min-w-[200px] flex-1 text-sm font-semibold">Title (optional)<input className={cx(input, 'mt-1')} placeholder="e.g. Northwind QBR deck" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          </div>
          <p className="text-sm text-muted">
            {type ? `Ideal pace ${type.ideal} · ` : ''}Target {fmtMin(target > 0 ? target : 0)}
            {lead && <> · <Chip tone="coral"><Star size={11} /> Sent as priority</Chip></>}
          </p>
          <Btn
            disabled={!assignee}
            onClick={() => {
              if (safe(() => assign({ typeId, variant: type?.variants ? variant : undefined, customName, customUnit, qty, targetMinutes: target, projectId: project.id, assigneeId: assignee ?? '', title }))) {
                toast({ title: `Task sent to ${first(assignee)}`, tone: 'success' });
                setTitle('');
              }
            }}
          >
            <Send size={14} /> Assign
          </Btn>
        </div>
      </Card>

      <Card>
        <H2 right={<span className="text-xs text-muted">{assigned.length} total</span>}>Tasks you assigned</H2>
        {assigned.length === 0 ? <p className="text-sm text-muted">Nothing assigned yet.</p> : <ul className="divide-y divide-line">{assigned.map((t) => <AssignedRow key={t.id} t={t} />)}</ul>}
      </Card>
    </div>
  );
}
