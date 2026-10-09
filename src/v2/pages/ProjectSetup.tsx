import { useState } from 'react';
import { Modal, toast } from '@/components';
import { day, PEOPLE } from '../data';
import { useStore } from '../store';
import { Avatar, Btn, cx, input, safe } from '../ui';

/** Onboard a new project: name, dates and how many hours a day each person gives it. */
export function ProjectSetup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, proposeProject } = useStore();
  const lead = ['manager', 'founder'].includes(PEOPLE.find((p) => p.id === me)?.role ?? '');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [startDate, setStart] = useState(day(0));
  const [endDate, setEnd] = useState(day(90));
  const [hours, setHours] = useState<Record<string, number>>({});
  const [err, setErr] = useState('');
  const team = PEOPLE.filter((p) => p.role === 'resource' || p.role === 'pm');
  void day;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead ? "Onboard a new project" : "Propose a new project"}
      description={lead ? undefined : "Once a manager or founder approves it, you own it and can assign tasks."}
      size="lg"
      footer={
        <Btn
          onClick={() => {
            if (safe(() => proposeProject({ name, client, description, startDate, endDate, hours }), setErr)) {
              toast({ title: lead ? `${name} is live 🎉` : `${name} sent to management for approval`, tone: 'success' });
              setName(''); setClient(''); setDescription(''); setHours({}); setErr('');
              onClose();
            }
          }}
        >
          {lead ? 'Create project' : 'Send for approval'}
        </Btn>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Project name<input className={cx(input, 'mt-1')} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Orbit AI – EU Outbound" /></label>
        <label className="text-sm font-semibold">Client<input className={cx(input, 'mt-1')} value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Orbit AI" /></label>
        <label className="text-sm font-semibold">Start date<input type="date" className={cx(input, 'mt-1')} value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="text-sm font-semibold">End date<input type="date" className={cx(input, 'mt-1')} value={endDate} onChange={(e) => setEnd(e.target.value)} /></label>
        <label className="text-sm font-semibold sm:col-span-2">Description<textarea className={cx(input, 'mt-1')} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who are we reaching, and what does success look like?" /></label>
      </div>
      <p className="mb-2 mt-5 text-sm font-semibold">Team & hours per day</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {team.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
            <Avatar id={p.id} size="sm" />
            <span className="flex-1 text-sm">{p.name} <span className="text-xs text-muted">· {p.title}</span></span>
            <div className="flex gap-1">
              {[0, 2, 4, 6, 8].map((h) => (
                <button
                  key={h}
                  onClick={() => setHours((s) => ({ ...s, [p.id]: h }))}
                  className={cx('focus-ring rounded-lg px-2 py-1 text-xs font-semibold', (hours[p.id] ?? 0) === h ? 'bg-accent text-accent-on' : 'bg-surface-2 text-muted')}
                >
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
