import { useState } from 'react';
import { Modal, toast } from '@/components';
import { day, PEOPLE } from '../data';
import { useStore } from '../store';
import { Avatar, Btn, cx, input, safe } from '../ui';

/** Onboard a new project: name, dates and how many hours a day each person gives it. */
export function ProjectSetup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { me, createProject } = useStore();
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [startDate, setStart] = useState(day(0));
  const [endDate, setEnd] = useState(day(90));
  const [hours, setHours] = useState<Record<string, number>>({});
  const [err, setErr] = useState('');
  const team = PEOPLE.filter((p) => p.role === 'resource' || p.role === 'pm');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Onboard a new project"
      size="lg"
      footer={
        <Btn
          onClick={() => {
            const pmId = PEOPLE.find((p) => p.id === me)?.role === 'pm' ? me : 'meera';
            if (safe(() => createProject({ name, client, startDate, endDate, hours, pmId }), setErr)) {
              toast({ title: `${name} is live 🎉`, tone: 'celebrate' });
              setName(''); setClient(''); setHours({}); setErr('');
              onClose();
            }
          }}
        >
          Create project
        </Btn>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">Project name<input className={cx(input, 'mt-1')} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Orbit AI – EU Outbound" /></label>
        <label className="text-sm font-semibold">Client<input className={cx(input, 'mt-1')} value={client} onChange={(e) => setClient(e.target.value)} placeholder="e.g. Orbit AI" /></label>
        <label className="text-sm font-semibold">Start date<input type="date" className={cx(input, 'mt-1')} value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
        <label className="text-sm font-semibold">End date<input type="date" className={cx(input, 'mt-1')} value={endDate} onChange={(e) => setEnd(e.target.value)} /></label>
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
