import { useEffect, useState } from 'react';
import { BellRing, Gauge, History, Pencil, Plus, Send, ShoppingBasket, Star, Trash2 } from 'lucide-react';
import { toast } from '@/components';
import {
  canManage, day, findCustomStandard, fmtDay, isAdmin, isLeadRole, isOwner, parseDay, PEOPLE, previousWorkingDay, standardFor, TASK_TYPES, taskTitle,
  type Project, type Task,
} from '../data';
import { difficulty, type Difficulty } from '../analytics';
import { first, useStore, type AssignInput } from '../store';
import { TaskCalendar } from './Widgets';
import { DifficultyBadge, HistoryTimeline, HistoryToggle, ResubmitChip, TaskDifficulty, taskStandard } from './TaskCard';
import { Avatar, Btn, Card, Chip, H2, STATUS, cx, fmtMin, input, safe } from '../ui';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type StdInput = Pick<AssignInput, 'projectId' | 'typeId' | 'qty' | 'variant' | 'customName' | 'customStandardId'>;
/** The custom standard an assign request uses: its typeId, its customStandardId, or a custom name that matches one. */
function customStdOf(p: Project | undefined, i: StdInput) {
  if (i.typeId === 'custom') return findCustomStandard(p, i.customStandardId) ?? findCustomStandard(p, i.customName);
  return TASK_TYPES.some((t) => t.id === i.typeId) ? undefined : findCustomStandard(p, i.typeId);
}
/** Standard minutes for an assign request on its project (core standard logic); null = custom task with no standard. */
function standardOf(projects: Project[], i: StdInput): number | null {
  if (!(i.qty > 0)) return null;
  const p = projects.find((x) => x.id === i.projectId);
  if (i.typeId === 'custom') {
    const cs = customStdOf(p, i);
    return cs ? standardFor(p, 'custom', i.qty, undefined, cs.id) : null;
  }
  return standardFor(p, i.typeId, i.qty, i.variant);
}
const levelOf = (target: number, std: number | null): Difficulty | 'none' => (std == null ? 'none' : difficulty(target, std).level);

function AssignedRow({ t }: { t: Task }) {
  const { projects, editTask, remind } = useStore();
  const [edit, setEdit] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [qty, setQty] = useState(t.qty);
  const [target, setTarget] = useState(t.targetMinutes);
  const [title, setTitle] = useState(t.title);
  const open = t.status !== 'done' && t.status !== 'in_review';
  const std = taskStandard(t);
  // While editing, the standard scales with the quantity (as the store does on save).
  const editStd = std != null && qty > 0 && t.qty > 0 ? Math.max(1, Math.round((std * qty) / t.qty)) : std;
  return (
    <li className="py-3" data-assigned={t.id}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Avatar id={t.assigneeId} size="sm" />
        <div className="min-w-[200px] flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold first-letter:uppercase">
            {t.title} {t.priority && <Chip tone="coral"><Star size={11} /> Priority</Chip>}
            <ResubmitChip task={t} />
          </p>
          <p className="text-xs text-muted">
            {first(t.assigneeId)} · {projects.find((p) => p.id === t.projectId)?.name} · target {fmtMin(t.targetMinutes)}{t.date !== day(0) ? ` · for ${fmtDay(t.date)}` : ''}{t.reminders > 0 && ` · reminded ${t.reminders}x`}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <TaskDifficulty task={t} />
            <HistoryToggle task={t} open={showHistory} onClick={() => setShowHistory((v) => !v)} />
          </div>
        </div>
        <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
        {open && (
          <Btn tone="ghost" className="border border-line" onClick={() => safe(() => { remind(t.id); toast({ title: `Reminder sent to ${first(t.assigneeId)}`, tone: 'info' }); })}>
            <BellRing size={13} /> Remind
          </Btn>
        )}
        {t.status !== 'done' && <Btn tone="ghost" className="border border-line" onClick={() => setEdit((v) => !v)}><Pencil size={13} /> Edit</Btn>}
      </div>
      {showHistory && <HistoryTimeline task={t} className="mt-2 sm:ml-10" />}
      {edit && (
        <form
          className="mt-2 sm:ml-10 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (safe(() => editTask(t.id, { qty, targetMinutes: target, title }))) {
              setEdit(false);
              toast({ title: 'Task updated', tone: 'success' });
            }
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_100px_120px_auto]">
            <input aria-label="Title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
            <input aria-label="Quantity" type="number" min={1} className={input} value={qty} onChange={(e) => setQty(+e.target.value)} />
            <input aria-label="Target minutes" type="number" min={1} className={input} value={target} onChange={(e) => setTarget(+e.target.value)} />
            <Btn type="submit">Save</Btn>
          </div>
          {target > 0 && <DifficultyBadge target={target} standard={editStd} />}
        </form>
      )}
    </li>
  );
}

/** A task waiting in today's list. `pace` = target minutes per unit, so changing the quantity keeps the difficulty. */
type CartItem = AssignInput & { key: string; pace: number; from?: string };
let cartKey = 0;

export default function Assign() {
  const { me, tasks, projects, assignMany } = useStore();
  const lead = isLeadRole(PEOPLE.find((p) => p.id === me)?.role);
  // Owners, project admins, managers and founders can assign on a project.
  const choices = projects.filter((p) => p.status === 'active' && canManage(p, me));
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

  const customStds = project?.customStandards ?? [];
  // A project custom standard picked on another project falls back to the first built-in type.
  const typeKey = typeId === 'custom' || TASK_TYPES.some((t) => t.id === typeId) || customStds.some((s) => s.id === typeId) ? typeId : 'l1';
  const type = TASK_TYPES.find((t) => t.id === typeKey);
  const pickedStd = customStds.find((s) => s.id === typeKey);
  const draft: StdInput = { projectId: project?.id ?? '', typeId: typeKey, qty, variant: type?.variants ? variant : undefined, customName: typeKey === 'custom' ? customName : undefined };
  const std = project ? standardOf(projects, draft) : null;
  const matchedStd = typeKey === 'custom' ? customStdOf(project, draft) : undefined;
  useEffect(() => { if (!targetEdited && std != null) setTarget(std); }, [std, targetEdited]);
  const assignee = people.some((p) => p.id === assigneeId) ? assigneeId : people[0]?.id;
  const assigned = tasks.filter((t) => t.assignedById === me);
  const openAssigned = assigned.filter((t) => t.status !== 'done' && t.status !== 'in_review');

  // Yesterday's tasks = the previous working day (Monday pulls Friday).
  const prevDay = previousWorkingDay(day(0));
  const prevWeekday = WEEKDAY[parseDay(prevDay).getDay()];
  const prevLabel = `${prevWeekday.slice(0, 3)} ${fmtDay(prevDay)}`;
  const prevIsYesterday = prevDay === day(-1);
  const prevAll = tasks.filter((t) => t.assignedById === me && t.date === prevDay && choices.some((p) => p.id === t.projectId));
  // Tasks still open are carried over already; re-using them would duplicate open work.
  const prevTasks = prevAll.filter((t) => t.status === 'done' || t.status === 'in_review');
  const prevOpen = prevAll.length - prevTasks.length;
  const prevByPerson = [...new Set(prevTasks.map((t) => t.assigneeId))].map((id) => ({ id, n: prevTasks.filter((t) => t.assigneeId === id).length }));

  if (!project) return <Card><p className="py-8 text-center text-muted">You'll be able to assign tasks once you own or help run (as a project admin) an approved project.</p></Card>;

  const proj = (id: string) => projects.find((p) => p.id === id);
  const label = (i: CartItem) => {
    if (i.title?.trim()) return i.title.trim();
    const cs = customStdOf(proj(i.projectId), i);
    if (cs) return `${i.qty} ${cs.name}`;
    if (i.typeId === 'custom') return `${i.qty} ${i.customName?.trim() || 'custom task'}`;
    return taskTitle(i.typeId, i.qty, i.variant);
  };
  const addToList = () => {
    if (!assignee) return toast({ title: 'Pick who the task is for', tone: 'info', emoji: '⚠️' });
    if (!(qty > 0) || !(target > 0)) return toast({ title: 'Quantity and target time must be above zero', tone: 'info', emoji: '⚠️' });
    if (typeKey === 'custom' && !customName.trim()) return toast({ title: 'Name the custom task', tone: 'info', emoji: '⚠️' });
    setCart((c) => [...c, {
      key: `c${++cartKey}`, typeId: typeKey, variant: type?.variants ? variant : undefined,
      customName: typeKey === 'custom' ? customName : undefined, customUnit: typeKey === 'custom' ? customUnit : undefined,
      qty, targetMinutes: target, pace: target / qty, projectId: project.id, assigneeId: assignee, title,
    }]);
    setTitle('');
  };
  const loadYesterday = () => {
    if (!prevTasks.length) return toast({ title: `You didn't assign anything on ${prevLabel}`, tone: 'info' });
    const fresh = prevTasks.filter((t) => !cart.some((i) => i.from === t.id));
    if (!fresh.length) return toast({ title: `${prevWeekday}'s tasks are already in today's list`, tone: 'info' });
    setCart((c) => [...c, ...fresh.map((t): CartItem => {
      const custom = t.typeId === 'custom';
      const name = custom ? t.customName || t.title.replace(/^\d+\s*/, '') : undefined;
      const auto = custom ? `${t.qty} ${name}` : taskTitle(t.typeId, t.qty, t.variant);
      return {
        key: `c${++cartKey}`, from: t.id, typeId: t.typeId, variant: t.variant, customName: name, customUnit: custom ? t.unit : undefined,
        customStandardId: t.customStandardId, qty: t.qty, targetMinutes: t.targetMinutes, pace: t.targetMinutes / t.qty,
        projectId: t.projectId, assigneeId: t.assigneeId, title: t.title !== auto ? t.title : '',
      };
    })]);
    toast({
      title: `Added ${fresh.length} task${fresh.length > 1 ? 's' : ''} from ${prevLabel}${prevIsYesterday ? '' : ' (previous working day)'}`,
      description: 'Tweak the numbers, then assign.',
      tone: 'success',
    });
  };
  const update = (key: string, p: Partial<CartItem>) => setCart((c) => c.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const changeQty = (i: CartItem, q: number) => update(i.key, { qty: q, ...(q > 0 && i.pace > 0 ? { targetMinutes: Math.max(1, Math.round(i.pace * q)) } : {}) });
  const changeMin = (i: CartItem, m: number) => update(i.key, { targetMinutes: m, ...(m > 0 && i.qty > 0 ? { pace: m / i.qty } : {}) });
  const totalMin = cart.reduce((s, i) => s + (i.targetMinutes || 0), 0);
  const byPerson = [...new Set(cart.map((i) => i.assigneeId))];
  const mix = cart.reduce((m, i) => { m[levelOf(i.targetMinutes, standardOf(projects, i))]++; return m; }, { challenging: 0, standard: 0, easy: 0, none: 0 } as Record<Difficulty | 'none', number>);
  const roleOn = (p: Project) => (isOwner(p, me) ? 'owner' : isAdmin(p, me) ? 'admin' : '');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Assign tasks</h1>

      <section aria-label="Yesterday's tasks" className="flex flex-wrap items-center gap-4 rounded-card border border-accent/30 bg-accent-soft/60 p-4 shadow-soft">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-on"><History size={20} /></span>
        <div className="min-w-[220px] flex-1">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            Yesterday's tasks
            <Chip tone="sky">{prevLabel}{prevIsYesterday ? '' : ' · previous working day'}</Chip>
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {prevTasks.length
              ? <>You assigned {prevTasks.length} task{prevTasks.length > 1 ? 's' : ''} on {prevIsYesterday ? 'yesterday' : prevWeekday} ({prevByPerson.map((x) => `${first(x.id)} ${x.n}`).join(', ')}). Pull them into today's list, tweak and assign.{prevOpen > 0 && <> {prevOpen} still open from {prevWeekday.slice(0, 3)} {prevOpen > 1 ? 'are' : 'is'} carried over, so {prevOpen > 1 ? 'they are' : 'it is'} left out.</>}</>
              : <>You didn't assign anything on {prevLabel}. Build today's list below.</>}
          </p>
        </div>
        <Btn onClick={loadYesterday} disabled={!prevTasks.length}><History size={14} /> {prevTasks.length ? `Use ${prevIsYesterday ? "yesterday's" : `${prevWeekday}'s`} ${prevTasks.length} task${prevTasks.length > 1 ? 's' : ''}` : 'Nothing to pull'}</Btn>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card>
          <H2>Add a task</H2>
          <div className="space-y-5">
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase text-muted">Project</p>
              <div className="flex flex-wrap gap-2">
                {choices.map((p) => (
                  <Btn key={p.id} tone={p.id === project.id ? 'primary' : 'ghost'} className="border border-line" onClick={() => setProjectId(p.id)}>
                    {p.name}{roleOn(p) && <span className="text-[11px] font-normal opacity-80">· {roleOn(p)}</span>}
                  </Btn>
                ))}
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
                  <Btn key={t.id} tone={t.id === typeKey ? 'primary' : 'ghost'} className="border border-line" onClick={() => { setTypeId(t.id); setTargetEdited(false); setQty(t.id === 'deck' ? 1 : t.id === 'model' ? 10 : 30); }}>{t.name}</Btn>
                ))}
                <Btn tone={typeKey === 'custom' ? 'primary' : 'ghost'} className="border border-dashed border-line" onClick={() => { setTypeId('custom'); setTargetEdited(true); }}>+ Custom task</Btn>
              </div>
              {customStds.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase text-muted">{project.name} custom tasks</p>
                  <div className="flex flex-wrap gap-2">
                    {customStds.map((s) => (
                      <Btn
                        key={s.id}
                        data-custom-standard={s.id}
                        tone={s.id === typeKey ? 'primary' : 'ghost'}
                        className="border border-line"
                        onClick={() => { setTypeId(s.id); setTargetEdited(false); setQty(Math.max(1, Math.round(30 / s.minutes))); }}
                      >
                        {s.name} <span className="text-[11px] font-normal opacity-80">· {s.minutes} min per {s.unit.replace(/s$/, '') || 'unit'}</span>
                      </Btn>
                    ))}
                  </div>
                </div>
              )}
              {type?.variants && <div className="mt-2 flex flex-wrap gap-2">{type.variants.map((v) => <Btn key={v} tone={v === variant ? 'soft' : 'ghost'} onClick={() => { setVariant(v); setTargetEdited(false); }}>{v}</Btn>)}</div>}
              {typeKey === 'custom' && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <input className={input} aria-label="Custom task name" placeholder="Task name, e.g. LinkedIn profile audit" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                  <input className={input} aria-label="Custom task unit" placeholder="Unit, e.g. profiles" value={matchedStd ? matchedStd.unit : customUnit} disabled={!!matchedStd} onChange={(e) => setCustomUnit(e.target.value)} />
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className="w-28 text-sm font-semibold">Quantity<input type="number" min={1} aria-label="Quantity" className={cx(input, 'mt-1')} value={qty} onChange={(e) => setQty(+e.target.value)} /></label>
              <label className="w-36 text-sm font-semibold">Target time (min)<input type="number" min={1} aria-label="Target time (min)" className={cx(input, 'mt-1')} value={target} onChange={(e) => { setTarget(+e.target.value); setTargetEdited(true); }} /></label>
              {std != null && target !== std && <Btn tone="ghost" className="border border-line" onClick={() => { setTarget(std); setTargetEdited(false); }}>Reset to standard {fmtMin(std)}</Btn>}
              <label className="min-w-[200px] flex-1 text-sm font-semibold">Title (optional)<input className={cx(input, 'mt-1')} placeholder="e.g. Northwind QBR deck" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            </div>
            <div className="flex gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm" data-testid="draft-difficulty">
              <Gauge size={16} className="mt-0.5 shrink-0 text-muted" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {std != null
                    ? <span>Standard for {qty} {pickedStd?.unit ?? matchedStd?.unit ?? type?.unit ?? 'items'} on this project: <b>{fmtMin(std)}</b> · your target <b>{fmtMin(target > 0 ? target : 0)}</b></span>
                    : <span>Target <b>{fmtMin(target > 0 ? target : 0)}</b> · no standard time for this custom task yet</span>}
                  {target > 0 && <DifficultyBadge target={target} standard={std} showStandard={false} />}
                </p>
                {type && <p className="text-xs text-muted">Ideal pace {type.ideal}</p>}
                {matchedStd && <p className="text-xs text-muted">Matches the project task "{matchedStd.name}" ({matchedStd.minutes} min per {matchedStd.unit.replace(/s$/, '')})</p>}
                {typeKey === 'custom' && !matchedStd && <p className="text-xs text-muted">Add it as a custom task under <b>Edit project details</b> on the Projects page to track difficulty.</p>}
              </div>
            </div>
            <Btn tone="soft" onClick={addToList}><Plus size={14} /> Add to list</Btn>
          </div>
        </Card>

        <Card className="flex flex-col xl:sticky xl:top-20 xl:max-h-[calc(100vh-7rem)]">
          <H2 right={<Chip tone="sky">{cart.length} task{cart.length === 1 ? '' : 's'}</Chip>}><ShoppingBasket size={18} className="mr-1.5 inline" /> Today's list</H2>
          {cart.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Add tasks on the left, or use {prevIsYesterday ? "yesterday's" : `${prevWeekday}'s`} tasks.<br />Everything collects here before you assign.</p>
          ) : (
            <div className="-mx-2 flex-1 space-y-4 overflow-y-auto px-2">
              {byPerson.map((pid) => (
                <div key={pid}>
                  <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold"><Avatar id={pid} size="sm" /> {first(pid)} <span className="text-xs font-normal text-muted">· {fmtMin(cart.filter((i) => i.assigneeId === pid).reduce((s, i) => s + (i.targetMinutes || 0), 0))}</span></p>
                  <ul className="space-y-2">
                    {cart.filter((i) => i.assigneeId === pid).map((i) => (
                      <li key={i.key} className="rounded-xl border border-line bg-surface-2 p-2.5 text-sm" data-cart-item={i.key}>
                        <div className="flex items-start gap-2">
                          <span className="min-w-0 flex-1"><b className="first-letter:uppercase">{label(i)}</b><span className="block text-xs text-muted">{proj(i.projectId)?.name}{i.from ? ` · from ${prevLabel}` : ''}</span></span>
                          <button aria-label={i.priority ? 'Remove priority' : 'Mark as priority'} title={i.priority ? 'Priority, click to remove' : 'Mark as priority'} aria-pressed={!!i.priority} className={cx('focus-ring rounded-lg p-1', i.priority ? 'text-coral-ink' : 'text-muted hover:bg-line')} onClick={() => update(i.key, { priority: !i.priority })}><Star size={14} fill={i.priority ? 'currentColor' : 'none'} /></button>
                          <button aria-label={`Remove ${label(i)}`} className="focus-ring rounded-lg p-1 text-muted hover:bg-line hover:text-coral-ink" onClick={() => setCart((c) => c.filter((x) => x.key !== i.key))}><Trash2 size={14} /></button>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <label className="flex items-center gap-1 text-xs text-muted">Qty<input type="number" min={1} className={cx(input, 'w-20 py-1')} value={i.qty} onChange={(e) => changeQty(i, +e.target.value)} /></label>
                          <label className="flex items-center gap-1 text-xs text-muted">Min<input type="number" min={1} className={cx(input, 'w-20 py-1')} value={i.targetMinutes} onChange={(e) => changeMin(i, +e.target.value)} /></label>
                        </div>
                        <DifficultyBadge target={i.targetMinutes} standard={standardOf(projects, i)} className="mt-2" />
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
            {cart.length > 0 && (
              <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" data-testid="cart-mix">
                <span className="font-semibold text-muted">Difficulty</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-coral-strong" />{mix.challenging} challenging</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sky-strong" />{mix.standard} standard</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-butter-strong" />{mix.easy} easy</span>
                {mix.none > 0 && <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-grey-strong" />{mix.none} no standard</span>}
              </p>
            )}
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
        <H2 right={<span className="text-xs text-muted">{openAssigned.length} open</span>}>Still open: edit or remind</H2>
        {openAssigned.length === 0 ? <p className="text-sm text-muted">Everything you assigned is done or in review ☀️</p> : <ul className="divide-y divide-line" data-testid="still-open">{openAssigned.map((t) => <AssignedRow key={t.id} t={t} />)}</ul>}
      </Card>

      <Card>
        <H2 right={<span className="text-xs text-muted">{assigned.length} total</span>}>Tasks you assigned, by date</H2>
        <TaskCalendar tasks={assigned} who="assigner" />
      </Card>
    </div>
  );
}
