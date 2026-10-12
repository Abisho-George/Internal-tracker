import { useEffect, useState } from 'react';
import { Modal, toast } from '@/components';
import { day, DEFAULT_STANDARDS, PEOPLE, type Project, type Standards } from '../data';
import { useStore } from '../store';
import { Avatar, Btn, cx, input, safe } from '../ui';

const STD_FIELDS: { key: keyof Standards; label: string; hint: string }[] = [
  { key: 'prospect', label: 'Prospect mapping', hint: 'minutes per prospect' },
  { key: 'l1', label: '1st level message', hint: 'minutes per personalised message (semi = ⅔, templated = ½)' },
  { key: 'l2', label: '2nd level message', hint: 'minutes per message' },
];

/** Onboard a new project, or (with `edit`) change an existing project's details. */
export function ProjectSetup({ open, onClose, edit }: { open: boolean; onClose: () => void; edit?: Project }) {
  const { me, proposeProject, updateProject } = useStore();
  const lead = ['manager', 'founder'].includes(PEOPLE.find((p) => p.id === me)?.role ?? '');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [startDate, setStart] = useState(day(0));
  const [endDate, setEnd] = useState(day(90));
  const [hours, setHours] = useState<Record<string, number>>({});
  const [standards, setStandards] = useState<Standards>(DEFAULT_STANDARDS);
  const [err, setErr] = useState('');
  const team = PEOPLE.filter((p) => p.role === 'resource' || p.role === 'pm');

  useEffect(() => {
    if (!open) return;
    setErr('');
    if (edit) {
      setName(edit.name); setClient(edit.client); setDescription(edit.description); setStart(edit.startDate); setEnd(edit.endDate);
      setHours(edit.hours); setStandards({ ...DEFAULT_STANDARDS, ...edit.standards });
    }
  }, [open, edit]);

  const submit = () => {
    if (edit) {
      if (safe(() => updateProject(edit.id, { name: name.trim(), client: client.trim(), description: description.trim(), startDate, endDate, hours, standards }), setErr)) {
        toast({ title: 'Project details updated', tone: 'success' });
        onClose();
      }
      return;
    }
    if (safe(() => proposeProject({ name, client, description, startDate, endDate, hours, standards }), setErr)) {
      toast({ title: lead ? `${name} is live 🎉` : `${name} sent to management for approval`, tone: 'success' });
      setName(''); setClient(''); setDescription(''); setHours({}); setStandards(DEFAULT_STANDARDS); setErr('');
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? 'Edit project details' : lead ? 'Onboard a new project' : 'Propose a new project'}
      description={edit ? undefined : lead ? undefined : 'Once a manager or founder approves it, you own it and can assign tasks.'}
      size="lg"
      footer={<Btn onClick={submit}>{edit ? 'Save changes' : lead ? 'Create project' : 'Send for approval'}</Btn>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Project name<input className={cx(input, 'mt-1')} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Orbit AI – EU Outbound" /></label>
        <label className="text-sm font-semibold">Client<input className={cx(input, 'mt-1')} value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Orbit AI" /></label>
        <label className="text-sm font-semibold">Start date<input type="date" className={cx(input, 'mt-1')} value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="text-sm font-semibold">End date<input type="date" className={cx(input, 'mt-1')} value={endDate} onChange={(e) => setEnd(e.target.value)} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Description<textarea className={cx(input, 'mt-1')} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who are we reaching, and what does success look like?" /></label>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-surface-2 p-4">
        <p className="text-sm font-bold">⏱️ Standard time for this project</p>
        <p className="mb-3 text-xs text-muted">Every target time and on-time % for this project is measured against these. Different projects can have different standards.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {STD_FIELDS.map((f) => (
            <label key={f.key} className="rounded-xl border border-line bg-surface p-3 text-sm">
              <span className="font-semibold">{f.label}</span>
              <span className="mt-1 flex items-baseline gap-1">
                <input type="number" min={0.1} step={0.1} aria-label={`${f.label} standard minutes`} className="w-20 rounded-lg border border-line px-2 py-1 text-lg font-extrabold" value={standards[f.key]} onChange={(e) => setStandards({ ...standards, [f.key]: +e.target.value })} />
                <span className="text-xs text-muted">min</span>
              </span>
              <span className="mt-1 block text-[11px] text-muted">{f.hint} · {Math.round(60 / (standards[f.key] || 1))} per hour</span>
            </label>
          ))}
        </div>
      </div>

      <p className="mb-2 mt-5 text-sm font-semibold">Team & hours per day</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {team.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
            <Avatar id={p.id} size="sm" />
            <span className="flex-1 text-sm">{p.name} <span className="text-xs text-muted">· {p.title}</span></span>
            <div className="flex gap-1">
              {[0, 2, 4, 6, 8].map((h) => (
                <button key={h} onClick={() => setHours((s) => ({ ...s, [p.id]: h }))}
                  className={cx('focus-ring rounded-lg px-2 py-1 text-xs font-semibold', (hours[p.id] ?? 0) === h ? 'bg-accent text-accent-on' : 'bg-surface-2 text-muted')}>
                  {h ? `${h}h` : '—'}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {err && <p role="alert" className="mt-3 text-sm font-semibold text-coral-ink">{err}</p>}
    </Modal>
  );
}
