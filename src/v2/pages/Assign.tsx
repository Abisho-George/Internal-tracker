import { useEffect, useState } from 'react';
import { BellRing, History, Pencil, Plus, Send, ShoppingBasket, Star, Trash2 } from 'lucide-react';
import { toast } from '@/components';
import { day, isLeadRole, PEOPLE, TASK_TYPES, targetFor, taskTitle, type Task } from '../data';
import { first, useStore, type AssignInput } from '../store';
import { TaskCalendar } from './Widgets';
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

type CartItem = AssignInput & { key: string };
let cartKey = 0;

export default function Assign() {
  const { me, tasks, projects, assignMany } = useStore();
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const type = TASK_TYPES.find((t) => t.id === typeId);
  const assignee = people.some((p) => p.id === assigneeId) ? assigneeId : people[0]?.id;
  const auto = type ? targetFor(typeId, qty, type.variants ? variant : undefined) : target;
  useEffect(() => { if (!targetEdited && type) setTarget(auto); }, [auto, targetEdited, type]);
  const assigned = tasks.filter((t) => t.assignedById === me);
  const openAssigned = assigned.filter((t) => t.status !== 'done' && t.status !== 'in_review');

  if (!project) return <Card><p className="py-8 text-center text-muted">You'll be able to assign tasks once you own an approved project.</p></Card>;

  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? '';
  const label = (i: AssignInput) => i.title?.trim() || (i.typeId === 'custom' ? `${i.qty} ${i.customName || 'custom task'}` : taskTitle(i.typeId, i.qty, i.variant));
  const addToList = () => {
    if (!assignee) return toast({ title: 'Pick who the task is for', tone: 'info', emoji: '⚠️' });
    if (!(qty > 0) || !(target > 0)) return toast({ title: 'Quantity and target time must be above zero', tone: 'info', emoji: '⚠️' });
    if (typeId === 'custom' && !customName.trim()) return toast({ title: 'Name the custom task', tone: 'info', emoji: '⚠️' });
    setCart((c) => [...c, { key: `c${++cartKey}`, typeId, variant: type?.variants ? variant : undefined, customName, customUnit, qty, targetMinutes: target, projectId: project.id, assigneeId: assignee, title }]);
    setTitle('');
  };
  const loadYesterday = () => {
    const y = tasks.filter((t) => t.assignedById === me && t.date === day(-1));
    if (!y.length) return toast({ title: 'No tasks were assigned yesterday', tone: 'info' });
    setCart((c) => [...c, ...y.map((t) => ({
      key: `c${++cartKey}`, typeId: t.typeId, variant: t.variant, customName: t.typeId === 'custom' ? t.title.replace(/^\d+\s*/, '') : undefined,
      customUnit: t.unit, qty: t.qty, targetMinutes: t.targetMinutes, projectId: t.projectId, assigneeId: t.assigneeId, title: t.typeId === 'custom' ? t.title : '',
    }))]);
    toast({ title: `Added ${y.length} task${y.length > 1 ? 's' : ''} from yesterday — tweak and assign`, tone: 'success' });
  };
  const update = (key: string, p: Partial<CartItem>) => setCart((c) => c.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const totalMin = cart.reduce((s, i) => s + (i.targetMinutes || 0), 0);
  const byPerson = [...new Set(cart.map((i) => i.assigneeId))];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Assign tasks</h1>
        <Btn tone="soft" onClick={loadYesterday}><History size={14} /> Yesterday's tasks</Btn>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card>
          <H2>Add a task</H2>
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
              {type?.variants && <div className="mt-2 flex flex-wrap gap-2">{type.variants.map((v) => <Btn key={v} tone={v === variant ? 'soft' : 'ghost'} onClick={() => { setVariant(v); setTargetEdited(false); }}>{v}</Btn>)}</div>}
              {typeId === 'custom' && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input className={input} placeholder="Task name, e.g. LinkedIn profile audit" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                  <input className={input} placeholder="Unit, e.g. profiles" value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="text-sm font-semibold">Quantity<input type="number" min={1} className={cx(input, 'mt-1 w-28')} value={qty} onChange={(e) => setQty(+e.target.value)} /></label>
              <label className="text-sm font-semibold">Target time (min)<input type="number" min={1} className={cx(input, 'mt-1 w-32')} value={target} onChange={(e) => { setTarget(+e.target.value); setTargetEdited(true); }} /></label>
              {type && targetEdited && <Btn tone="ghost" onClick={() => setTargetEdited(false)}>Reset to {fmtMin(auto)}</Btn>}
              <label className="min-w-[200px] flex-1 text-sm font-semibold">Title (optional)<input className={cx(input, 'mt-1')} placeholder="e.g. Northwind QBR deck" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            </div>
            <p className="text-sm text-muted">{type ? `Ideal pace ${type.ideal} · ` : ''}Target {fmtMin(target > 0 ? target : 0)}</p>
            <Btn tone="soft" onClick={addToList}><Plus size={14} /> Add to list</Btn>
          </div>
        </Card>

        <Card className="flex flex-col xl:sticky xl:top-20 xl:max-h-[calc(100vh-7rem)]">
          <H2 right={<Chip tone="sky">{cart.length} task{cart.length === 1 ? '' : 's'}</Chip>}><ShoppingBasket size={18} className="mr-1.5 inline" /> Today's list</H2>
          {cart.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Add tasks on the left, or pull in yesterday's tasks.<br />Everything collects here before you assign.</p>
          ) : (
            <div className="-mx-2 flex-1 space-y-4 overflow-y-auto px-2">
              {byPerson.map((pid) => (
                <div key={pid}>
                  <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><Avatar id={pid} size="sm" /> {first(pid)} <span className="text-xs font-normal text-muted">· {fmtMin(cart.filter((i) => i.assigneeId === pid).reduce((s, i) => s + (i.targetMinutes || 0), 0))}</span></p>
                  <ul className="space-y-2">
                    {cart.filter((i) => i.assigneeId === pid).map((i) => (
                      <li key={i.key} className="rounded-xl border border-line bg-surface-2 p-2.5 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="min-w-0 flex-1"><b className="first-letter:uppercase">{label(i)}</b><span className="block text-xs text-muted">{projName(i.projectId)}</span></span>
                          <button aria-label={i.priority ? 'Remove priority' : 'Mark as priority'} title={i.priority ? 'Priority — click to remove' : 'Mark as priority'} aria-pressed={!!i.priority} className={cx('focus-ring rounded-lg p-1', i.priority ? 'text-coral-ink' : 'text-muted hover:bg-line')} onClick={() => update(i.key, { priority: !i.priority })}><Star size={14} fill={i.priority ? 'currentColor' : 'none'} /></button>
                          <button aria-label={`Remove ${label(i)}`} className="focus-ring rounded-lg p-1 text-muted hover:bg-line hover:text-coral-ink" onClick={() => setCart((c) => c.filter((x) => x.key !== i.key))}><Trash2 size={14} /></button>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <label className="flex items-center gap-1 text-xs text-muted">Qty<input type="number" min={1} className={cx(input, 'w-20 py-1')} value={i.qty} onChange={(e) => {
                            const q = +e.target.value;
                            update(i.key, { qty: q, ...(TASK_TYPES.some((t) => t.id === i.typeId) ? { targetMinutes: targetFor(i.typeId, q, i.variant) } : {}) });
                          }} /></label>
                          <label className="flex items-center gap-1 text-xs text-muted">Min<input type="number" min={1} className={cx(input, 'w-20 py-1')} value={i.targetMinutes} onChange={(e) => update(i.key, { targetMinutes: +e.target.value })} /></label>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 border-t border-line pt-4">
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cart.length > 0 && cart.every((i) => i.priority)} disabled={!cart.length} onChange={(e) => setCart((c) => c.map((i) => ({ ...i, priority: e.target.checked })))} />
              <Star size={14} className="text-coral-ink" /> Send all as priority
              <span className="ml-auto text-xs text-muted">{cart.filter((i) => i.priority).length} priority</span>
            </label>
            <p className="mb-3 flex justify-between text-sm"><span className="text-muted">Total target time</span><b>{fmtMin(totalMin)}</b></p>
            <div className="flex gap-2">
              <Btn className="flex-1" disabled={!cart.length} onClick={() => {
                if (safe(() => assignMany(cart))) {
                  toast({ title: `Assigned ${cart.length} task${cart.length > 1 ? 's' : ''} to ${byPerson.map(first).join(', ')}`, tone: 'success' });
                  setCart([]);
                }
              }}><Send size={14} /> Assign all</Btn>
              {cart.length > 0 && <Btn tone="ghost" className="border border-line" onClick={() => setCart([])}>Clear</Btn>}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <H2 right={<span className="text-xs text-muted">{assigned.length} total</span>}>Tasks you assigned — by date</H2>
        <TaskCalendar tasks={assigned} who="assigner" />
      </Card>

      <Card>
        <H2 right={<span className="text-xs text-muted">{openAssigned.length} open</span>}>Still open — edit or remind</H2>
        {openAssigned.length === 0 ? <p className="text-sm text-muted">Everything you assigned is done or in review ☀️</p> : <ul className="divide-y divide-line">{openAssigned.map((t) => <AssignedRow key={t.id} t={t} />)}</ul>}
      </Card>
    </div>
  );
}
