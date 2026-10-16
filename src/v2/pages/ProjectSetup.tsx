import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRightLeft, Crown, Plus, ShieldCheck, Trash, X } from 'lucide-react';
import { Modal, toast } from '@/components';
import { day, DEFAULT_STANDARDS, isLeadRole, PEOPLE, projectWeeks, roleOfPerson, TASK_TYPES, type Counts, type Project, type Standards } from '../data';
import { first, nameOf, useStore, type CustomStandardInput, type TransferMode } from '../store';
import { Avatar, Btn, cx, fmtMin, input, safe } from '../ui';

/** Default minutes per unit for every built-in task type. */
const DEFAULT_TYPE_MIN: Record<string, string> = Object.fromEntries(TASK_TYPES.map((t) => [t.id, String(t.perUnit)]));
const STD_HINT: Record<string, string> = { prospect: 'minutes per prospect', l1: 'minutes per personalised message (semi = ⅔, templated = ½)', l2: 'minutes per message' };

/** Number fields that stay readable in every theme: explicit surface background, ink text, big digits. */
const numField = 'focus-ring rounded-lg border-2 border-line bg-surface px-2 py-1 font-extrabold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-faint focus:border-accent';
const pickerCls = 'focus-ring min-w-0 max-w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink sm:min-w-[220px]';
const sectionBox = 'mt-5 rounded-2xl border border-line bg-surface-2 p-4';

type CsRow = { key: string; id?: string; name: string; unit: string; minutes: string };
type TeamRow = { id: string; h: string };
let tmp = 0;
const tmpKey = () => `row-${++tmp}`;
const num = (s: string) => Number(String(s).trim().replace(',', '.'));
const perHour = (m: number) => (m > 0 ? `${Math.round((60 / m) * 10) / 10} per hour` : '');
const hoursText = (h: number) => (h > 0 ? fmtMin(Math.round(h * 60)) : '');
const ROLE_GROUP: [string, string][] = [['pm', 'Project managers'], ['resource', 'Resources'], ['manager', 'Manager'], ['founder', 'Founders']];

function Section({ icon, title, hint, children, className }: { icon: ReactNode; title: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx(sectionBox, className)}>
      <p className="flex items-center gap-2 text-sm font-bold">{icon} {title}</p>
      {hint && <p className="mb-3 mt-0.5 text-xs text-muted">{hint}</p>}
      {children}
    </section>
  );
}

/** A select listing people (grouped by role), used to add someone. Resets after each pick. */
function PersonPicker({ label, exclude, onPick, roles }: { label: string; exclude: string[]; onPick: (id: string) => void; roles?: string[] }) {
  const groups = ROLE_GROUP.filter(([r]) => !roles || roles.includes(r));
  return (
    <select aria-label={label} className={pickerCls} value="" onChange={(e) => e.target.value && onPick(e.target.value)}>
      <option value="">{label}…</option>
      {groups.map(([r, l]) => {
        const list = PEOPLE.filter((p) => p.role === r && !exclude.includes(p.id));
        return list.length ? <optgroup key={r} label={l}>{list.map((p) => <option key={p.id} value={p.id}>{nameOf(p.id)} · {p.title}</option>)}</optgroup> : null;
      })}
    </select>
  );
}

/** Onboard a new project, or (with `edit`) change an existing project's details, admins and owner. */
export function ProjectSetup({ open, onClose, edit }: { open: boolean; onClose: () => void; edit?: Project }) {
  const { me, proposeProject, updateProject, setProjectAdmins, removeProjectAdmin, transferProject } = useStore();
  const lead = isLeadRole(roleOfPerson(me));
  const owner = edit ? edit.pmId : me;
  const canEditAdmins = !edit || edit.pmId === me || lead;
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [startDate, setStart] = useState(day(0));
  const [endDate, setEnd] = useState(day(90));
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [std, setStd] = useState<Record<string, string>>(DEFAULT_TYPE_MIN);
  const [off, setOff] = useState<string[]>([]);
  const [custom, setCustom] = useState<CsRow[]>([]);
  const [draftCs, setDraftCs] = useState({ name: '', unit: '', minutes: '' });
  const [admins, setAdmins] = useState<string[]>([]);
  const [newOwner, setNewOwner] = useState('');
  const [confirm, setConfirm] = useState<TransferMode | null>(null);
  const [justAdded, setJustAdded] = useState('');
  const [weekT, setWeekT] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<Record<string, Record<string, string>>>({});
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr(''); setConfirm(null); setNewOwner(''); setDraftCs({ name: '', unit: '', minutes: '' }); setJustAdded('');
    if (edit) {
      setName(edit.name); setClient(edit.client); setDescription(edit.description); setStart(edit.startDate); setEnd(edit.endDate);
      const ids = [...new Set([...Object.keys(edit.hours), ...edit.teamIds])];
      setTeam(ids.map((id) => ({ id, h: String(edit.hours[id] ?? 0) })));
      const s = { ...DEFAULT_STANDARDS, ...edit.standards };
      setStd({ ...DEFAULT_TYPE_MIN, ...Object.fromEntries(Object.entries(edit.typeMinutes ?? {}).map(([k, v]) => [k, String(v)])), prospect: String(s.prospect), l1: String(s.l1), l2: String(s.l2) });
      setOff(edit.typesOff ?? []);
      setCustom((edit.customStandards ?? []).map((c) => ({ key: c.id, id: c.id, name: c.name, unit: c.unit, minutes: String(c.minutes) })));
      setAdmins(edit.admins ?? []);
    }
  }, [open, edit]);

  const weeks = useMemo(() => (startDate && endDate && endDate >= startDate ? projectWeeks({ startDate, endDate }) : []), [startDate, endDate]);

  const resetCreate = () => {
    setWeekT({}); setPlans({});
    setName(''); setClient(''); setDescription(''); setTeam([]); setStd(DEFAULT_TYPE_MIN); setOff([]); setCustom([]); setAdmins([]); setErr('');
  };

  const addCustom = () => {
    const nm = draftCs.name.trim();
    const m = num(draftCs.minutes);
    if (!nm) return setErr('Give the custom task a name.');
    if (custom.some((c) => c.name.trim().toLowerCase() === nm.toLowerCase())) return setErr(`"${nm}" is already in the list.`);
    if (!(m > 0)) return setErr(`Set the minutes per unit for "${nm}" (above 0).`);
    setCustom((list) => [...list, { key: tmpKey(), name: nm, unit: draftCs.unit.trim() || 'items', minutes: String(m) }]);
    setDraftCs({ name: '', unit: '', minutes: '' });
    setErr('');
  };

  /** Turns the typed fields into store values; throws a friendly error if something is off. */
  const collect = () => {
    const on = TASK_TYPES.filter((t) => !off.includes(t.id));
    on.forEach((t) => { if (!(num(std[t.id]) > 0)) throw new Error(`Set the standard time for ${t.name.toLowerCase()} (above 0 minutes), or remove it.`); });
    const pick = (k: keyof Standards) => (num(std[k]) > 0 ? num(std[k]) : DEFAULT_STANDARDS[k]);
    const standards: Standards = { prospect: pick('prospect'), l1: pick('l1'), l2: pick('l2') };
    const typeMinutes = Object.fromEntries(on.filter((t) => !['prospect', 'l1', 'l2'].includes(t.id)).map((t) => [t.id, num(std[t.id])]));
    const typesOff = [...off];
    const hours: Record<string, number> = {};
    team.forEach((r) => {
      if (!r.h.trim()) throw new Error(`Type the hours per day for ${first(r.id)} (for example 1.5).`);
      const v = num(r.h);
      if (!Number.isFinite(v) || v < 0 || v > 12) throw new Error(`Hours per day for ${first(r.id)} must be between 0 and 12.`);
      hours[r.id] = v;
    });
    const customStandards: CustomStandardInput[] = custom.map((c) => ({ id: c.id, name: c.name, unit: c.unit, minutes: num(c.minutes) }));
    return { standards, typeMinutes, typesOff, hours, customStandards };
  };

  const submit = () => {
    if (edit) {
      const ok = safe(() => {
        const v = collect();
        updateProject(edit.id, { name: name.trim(), client: client.trim(), description: description.trim(), startDate, endDate, ...v });
        const same = admins.length === edit.admins.length && admins.every((a) => edit.admins.includes(a));
        if (canEditAdmins && !same) setProjectAdmins(edit.id, admins);
      }, setErr);
      if (ok) { toast({ title: 'Project details updated', tone: 'success' }); onClose(); }
      return;
    }
    const toCounts = (r: Record<string, string>, what: string): Counts => Object.fromEntries(Object.entries(r).filter(([, v]) => v.trim() !== '').map(([k, v]) => {
      const n = num(v);
      if (!Number.isFinite(n) || n < 0) throw new Error(`${what}: targets must be zero or more.`);
      return [k, Math.round(n)];
    }));
    if (safe(() => {
      const v = collect();
      const weekTarget = toCounts(weekT, 'Default weekly target');
      const weekPlans = Object.fromEntries(Object.entries(plans).filter(([ws]) => weeks.some((w) => w.start === ws)).map(([ws, r]) => [ws, { ...weekTarget, ...toCounts(r, 'Week plan') }]));
      proposeProject({ name, client, description, startDate, endDate, ...v, admins, weekTarget: Object.keys(weekTarget).length ? weekTarget : undefined, weekPlans });
    }, setErr)) {
      toast({ title: lead ? `${name} is live 🎉` : `${name} sent to management for approval`, tone: 'success' });
      resetCreate();
      onClose();
    }
  };

  const stepDown = () => {
    if (!edit) return;
    if (safe(() => removeProjectAdmin(edit.id, me), setErr)) { toast({ title: `You are no longer an admin of ${edit.name}`, tone: 'info' }); onClose(); }
  };

  const handover = (mode: TransferMode) => {
    if (!edit || !newOwner) return;
    if (safe(() => transferProject(edit.id, newOwner, mode), setErr)) {
      toast({ title: `${edit.name} handed over to ${first(newOwner)}`, tone: 'success' });
      onClose();
    }
  };

  const meOwner = edit?.pmId === me;
  const MODES: { mode: TransferMode; label: string; effect: string }[] = meOwner
    ? [
      { mode: 'remove-me', label: 'Transfer and remove myself', effect: 'You leave the project completely.' },
      { mode: 'stay-admin', label: 'Transfer and stay as admin', effect: 'You keep admin access: targets, numbers, tasks and details.' },
      { mode: 'stay-member', label: 'Transfer and stay as team member', effect: 'You stay on the team without admin access.' },
    ]
    : [
      { mode: 'remove-me', label: `Transfer and remove ${first(owner)}`, effect: `${first(owner)} leaves the project completely.` },
      { mode: 'stay-admin', label: `Transfer, ${first(owner)} stays as admin`, effect: `${first(owner)} keeps admin access.` },
      { mode: 'stay-member', label: `Transfer, ${first(owner)} stays as team member`, effect: `${first(owner)} stays on the team without admin access.` },
    ];
  const pending = MODES.find((m) => m.mode === confirm);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? 'Edit project details' : lead ? 'Onboard a new project' : 'Propose a new project'}
      description={edit ? 'Changes apply to this project only.' : lead ? undefined : 'Once a manager or founder approves it, you own it and can assign tasks.'}
      size="lg"
      footer={<>{err && <p role="alert" className="mr-auto text-sm font-semibold text-coral-ink">{err}</p>}<Btn tone="ghost" onClick={onClose}>Cancel</Btn><Btn onClick={submit}>{edit ? 'Save changes' : lead ? 'Create project' : 'Send for approval'}</Btn></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Project name<input className={cx(input, 'mt-1 text-ink')} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Orbit AI - EU Outbound" /></label>
        <label className="text-sm font-semibold">Client<input className={cx(input, 'mt-1 text-ink')} value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Orbit AI" /></label>
        <label className="text-sm font-semibold">Start date<input type="date" className={cx(input, 'mt-1 text-ink')} value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="text-sm font-semibold">End date<input type="date" className={cx(input, 'mt-1 text-ink')} value={endDate} onChange={(e) => setEnd(e.target.value)} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Description<textarea className={cx(input, 'mt-1 text-ink')} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who are we reaching, and what does success look like?" /></label>
      </div>


      <Section icon={<span>⏱️</span>} title="Standard time for this project" hint="Every target time and on-time % for this project is measured against these. Change any time, or remove the ones this project does not use (you can add them back).">
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-label="Standard times" data-testid="std-list">
          {TASK_TYPES.filter((t) => !off.includes(t.id)).map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-3 py-2" data-std={t.id}>
              <span className="min-w-[10rem] flex-1 text-sm font-semibold text-ink">{t.name}<span className="block text-[11px] font-normal text-muted">{STD_HINT[t.id] ?? `minutes per ${t.unit.replace(/s$/, '')}`}</span></span>
              <span className="flex items-baseline gap-1.5">
                <input type="number" inputMode="decimal" min={0.1} step={0.1} aria-label={`${t.name} standard minutes`} className={cx(numField, 'w-20 text-lg')} value={std[t.id] ?? ''} onChange={(e) => setStd({ ...std, [t.id]: e.target.value })} />
                <span className="w-28 text-xs text-muted">min{num(std[t.id]) > 0 ? ` · ${perHour(num(std[t.id]))}` : ''}</span>
              </span>
              <button type="button" aria-label={`Remove ${t.name}`} title="Not used on this project" className="focus-ring rounded-lg p-2 text-muted hover:bg-coral hover:text-coral-ink" onClick={() => setOff((o) => [...o, t.id])}><Trash size={15} /></button>
            </li>
          ))}
        </ul>
        {off.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted">Removed from this project:</span>
            {off.map((id) => {
              const t = TASK_TYPES.find((x) => x.id === id);
              return t ? <button type="button" key={id} className="focus-ring inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 font-semibold text-accent-ink hover:bg-surface-2" onClick={() => setOff((o) => o.filter((x) => x !== id))}><Plus size={11} /> {t.name}</button> : null;
            })}
          </div>
        )}
      </Section>

      <Section icon={<span>🧩</span>} title="Custom standard tasks" hint="Project-specific tasks with their own standard time, e.g. LinkedIn connection request at 0.5 min each. They show up as task types in Assign for this project.">
        {custom.length > 0 && (
          <ul className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-label="Custom standard tasks">
            {custom.map((c, i) => (
              <li key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_7rem_15rem_auto]">
                <input aria-label="Custom task name" className={cx(input, 'py-1.5 font-semibold text-ink')} value={c.name} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <input aria-label={`Unit for ${c.name}`} className={cx(input, 'hidden py-1.5 text-ink sm:block')} value={c.unit} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} />
                <span className="col-start-1 row-start-2 flex items-baseline gap-1.5 sm:col-start-auto sm:row-start-auto">
                  <input type="number" inputMode="decimal" min={0.1} step={0.1} aria-label={`Minutes per unit for ${c.name}`} className={cx(numField, 'w-20 text-lg')} value={c.minutes} onChange={(e) => setCustom((l) => l.map((x, j) => (j === i ? { ...x, minutes: e.target.value } : x)))} />
                  <span className="whitespace-nowrap text-xs text-muted">min per {c.unit.replace(/s$/, '') || 'item'}{num(c.minutes) > 0 ? ` · ${perHour(num(c.minutes))}` : ''}</span>
                </span>
                <button type="button" aria-label={`Delete ${c.name}`} title="Delete" className="focus-ring row-span-2 rounded-lg p-2 text-muted hover:bg-coral hover:text-coral-ink sm:row-span-1" onClick={() => setCustom((l) => l.filter((_, j) => j !== i))}><Trash size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_auto]">
          <input aria-label="New custom task name" className={cx(input, 'text-ink')} placeholder="Task name, e.g. LinkedIn connection request" value={draftCs.name} onChange={(e) => setDraftCs({ ...draftCs, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
          <input aria-label="New custom task unit" className={cx(input, 'text-ink')} placeholder="Unit, e.g. calls" value={draftCs.unit} onChange={(e) => setDraftCs({ ...draftCs, unit: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
          <input type="number" inputMode="decimal" min={0.1} step={0.1} aria-label="New custom task minutes per unit" className={cx(numField, 'w-full text-base')} placeholder="Min per unit" value={draftCs.minutes} onChange={(e) => setDraftCs({ ...draftCs, minutes: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())} />
          <Btn type="button" tone="soft" onClick={addCustom}><Plus size={14} /> Add task</Btn>
        </div>
      </Section>

      <Section icon={<span>👥</span>} title="Team and hours per day" hint={<>Type each person's hours per day, decimals are fine (1.5 = 1h 30m, 0.75 = 45m). {edit ? 'Setting 0 takes someone off the team.' : 'You are added to the team automatically.'}</>}>
        {team.length > 0 ? (
          <ul className="mb-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface" aria-label="Team and hours">
            {team.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <Avatar id={r.id} size="sm" />
                <span className="min-w-0 flex-1 text-sm text-ink">{nameOf(r.id)} <span className="text-xs text-muted">· {PEOPLE.find((p) => p.id === r.id)?.title}{r.id === owner ? ' · owner' : ''}</span></span>
                <span className="flex items-baseline gap-1.5">
                  <input type="number" inputMode="decimal" min={0} max={12} step={0.25} placeholder="e.g. 1.5" autoFocus={r.id === justAdded} aria-label={`Hours per day for ${nameOf(r.id)}`} className={cx(numField, 'w-24 text-lg')} value={r.h} onChange={(e) => setTeam((l) => l.map((x, j) => (j === i ? { ...x, h: e.target.value } : x)))} />
                  <span className="w-16 text-xs text-muted">h / day{hoursText(num(r.h)) && <span className="block text-[10px]">= {hoursText(num(r.h))}</span>}</span>
                </span>
                <button type="button" aria-label={`Remove ${nameOf(r.id)} from the team`} className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => setTeam((l) => l.filter((_, j) => j !== i))}><X size={14} /></button>
              </li>
            ))}
          </ul>
        ) : <p className="mb-3 text-xs text-muted">Nobody added yet.</p>}
        <PersonPicker label="Add a person to the team" roles={['pm', 'resource']} exclude={team.map((r) => r.id)} onPick={(id) => { setTeam((l) => [...l, { id, h: '' }]); setJustAdded(id); }} />
      </Section>

      <Section icon={<ShieldCheck size={15} className="text-accent" />} title="Project admins" hint="Admins can do everything the owner can on this project: set targets and numbers, assign tasks, book meetings and edit these details.">
        <div className="mb-3 flex flex-wrap items-center gap-2" aria-label="Owner and admins">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm text-ink"><Avatar id={owner} size="sm" /> {nameOf(owner)} <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-butter-ink"><Crown size={12} /> Owner</span></span>
          {admins.map((a) => (
            <span key={a} data-admin={a} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-1.5 text-sm text-ink">
              <Avatar id={a} size="sm" /> {nameOf(a)} <span className="text-xs font-semibold text-accent-ink">Admin</span>
              {canEditAdmins ? (
                <button type="button" aria-label={`Remove ${nameOf(a)} as admin`} className="focus-ring rounded-full p-1 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => setAdmins((l) => l.filter((x) => x !== a))}><X size={12} /></button>
              ) : <span className="w-1" />}
            </span>
          ))}
          {admins.length === 0 && <span className="text-xs text-muted">No admins yet.</span>}
        </div>
        {canEditAdmins ? (
          <PersonPicker label="Add an admin" exclude={[owner, ...admins]} onPick={(id) => setAdmins((l) => [...l, id])} />
        ) : edit?.admins.includes(me) ? (
          <Btn type="button" tone="ghost" className="border border-line bg-surface" onClick={stepDown}>Step down as admin</Btn>
        ) : null}
        {edit && canEditAdmins && <p className="mt-2 text-[11px] text-muted">Admin changes are saved with Save changes.</p>}
      </Section>

      {edit && (edit.pmId === me || lead) && (
        <Section className="border-peach-strong/60 bg-peach/30" icon={<ArrowRightLeft size={15} className="text-peach-ink" />} title="Handover"
          hint={<>Make someone else the owner in one click. They are told straight away, and management sees it in the project's updates. This happens immediately, separately from Save changes.</>}>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-ink" htmlFor="handover-to">New owner</label>
            <select id="handover-to" aria-label="New owner" className={pickerCls} value={newOwner} onChange={(e) => { setNewOwner(e.target.value); setConfirm(null); }}>
              <option value="">Pick a person…</option>
              {ROLE_GROUP.map(([r, l]) => {
                const list = PEOPLE.filter((p) => p.role === r && p.id !== edit.pmId);
                return list.length ? <optgroup key={r} label={l}>{list.map((p) => <option key={p.id} value={p.id}>{nameOf(p.id)} · {p.title}</option>)}</optgroup> : null;
              })}
            </select>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {MODES.map((m) => (
              <button key={m.mode} type="button" disabled={!newOwner} onClick={() => setConfirm(m.mode)}
                className={cx('focus-ring rounded-xl border-2 bg-surface p-3 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-50', confirm === m.mode ? 'border-accent' : 'border-line hover:border-accent/60')}>
                <span className="block font-bold text-ink">{m.label}</span>
                <span className="mt-0.5 block text-xs text-muted">{m.effect}</span>
              </button>
            ))}
          </div>
          {pending && newOwner && (
            <div role="alertdialog" aria-label="Confirm handover" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <p className="min-w-0 flex-1 text-sm text-ink">Hand <b>{edit.name}</b> over to <b>{nameOf(newOwner)}</b>? {pending.effect}</p>
              <Btn type="button" tone="ghost" onClick={() => setConfirm(null)}>Cancel</Btn>
              <Btn type="button" onClick={() => handover(pending.mode)}><ArrowRightLeft size={14} /> Confirm handover</Btn>
            </div>
          )}
        </Section>
      )}
    </Modal>
  );
}
