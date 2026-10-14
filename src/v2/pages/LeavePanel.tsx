import { useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/components';
import { addDays, day, fmtDay, isWorkingDay, parseDay } from '../data';
import { useStore, type Leave } from '../store';
import { Btn, Card, Chip, cx, H2 } from '../ui';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const field = 'focus-ring rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink';

/** Profile: add leave days (a single day or a range, full or half day). Shows across the app wherever that day appears. */
export function LeavePanel({ personId }: { personId: string }) {
  const { profiles, setProfile } = useStore();
  const leaves = [...(profiles[personId]?.leaves ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const [from, setFrom] = useState(day(0));
  const [to, setTo] = useState(day(0));
  const [kind, setKind] = useState<Leave['kind']>('full');
  const [note, setNote] = useState('');
  const add = () => {
    if (!from) return;
    const end = to && to >= from ? to : from;
    const days: string[] = [];
    for (let d = from; d <= end && days.length < 60; d = addDays(d, 1)) if (isWorkingDay(d)) days.push(d);
    if (!days.length) { toast({ title: 'Those days are all weekends', tone: 'info' }); return; }
    const kept = leaves.filter((l) => !days.includes(l.date));
    setProfile(personId, { leaves: [...kept, ...days.map((date) => ({ date, kind, note: note.trim() || undefined }))] });
    setNote('');
    toast({ title: days.length === 1 ? `Leave added for ${fmtDay(days[0])}` : `Leave added for ${days.length} days`, tone: 'success' });
  };
  const remove = (date: string) => setProfile(personId, { leaves: leaves.filter((l) => l.date !== date) });
  const upcoming = leaves.filter((l) => l.date >= day(0));
  const past = leaves.filter((l) => l.date < day(0)).reverse().slice(0, 10);
  const row = (l: Leave) => (
    <li key={l.date} className="flex items-center gap-2 py-1.5 text-sm" data-leave={l.date}>
      <span className="w-28 font-medium">{WD[parseDay(l.date).getDay()]} {fmtDay(l.date)}</span>
      <Chip tone={l.kind === 'full' ? 'lavender' : 'sky'}>{l.kind === 'full' ? 'Full day' : 'Half day'}</Chip>
      <span className="min-w-0 flex-1 truncate text-xs text-muted">{l.note}</span>
      <button aria-label={`Remove leave on ${l.date}`} className="focus-ring rounded p-1 text-muted hover:text-coral-ink" onClick={() => remove(l.date)}><Trash2 size={13} /></button>
    </li>
  );
  return (
    <Card>
      <H2><CalendarOff size={17} className="mr-1.5 inline text-lavender-ink" />Leave</H2>
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2/60 p-3" data-testid="leave-form">
        <label className="text-xs font-semibold text-muted">From<input type="date" aria-label="Leave from" className={cx(field, 'mt-1 block')} value={from} onChange={(e) => { setFrom(e.target.value); if (!to || e.target.value > to) setTo(e.target.value); }} /></label>
        <label className="text-xs font-semibold text-muted">To<input type="date" aria-label="Leave to" min={from} className={cx(field, 'mt-1 block')} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="text-xs font-semibold text-muted">Type
          <select aria-label="Leave type" className={cx(field, 'mt-1 block')} value={kind} onChange={(e) => setKind(e.target.value as Leave['kind'])}><option value="full">Full day</option><option value="half">Half day</option></select>
        </label>
        <label className="min-w-[10rem] flex-1 text-xs font-semibold text-muted">Note (optional)<input aria-label="Leave note" className={cx(field, 'mt-1 block w-full')} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Family function" /></label>
        <Btn onClick={add}><Plus size={14} /> Add leave</Btn>
      </div>
      <p className="mt-2 text-xs text-muted">Weekends are skipped. Leave shows on your daily update, the team view and your page for managers.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Upcoming</p>{upcoming.length ? <ul className="divide-y divide-line">{upcoming.map(row)}</ul> : <p className="mt-1 text-sm text-muted">No leave planned.</p>}</div>
        <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Past</p>{past.length ? <ul className="divide-y divide-line">{past.map(row)}</ul> : <p className="mt-1 text-sm text-muted">None yet.</p>}</div>
      </div>
    </Card>
  );
}

/** A small "On leave" label for a person on a day, or nothing. */
export function LeaveChip({ personId, date, className }: { personId: string; date: string; className?: string }) {
  const l = useStore((s) => s.profiles[personId]?.leaves?.find((x) => x.date === date));
  if (!l) return null;
  return <span className={className} data-on-leave={date} title={l.note}><Chip tone="lavender">{l.kind === 'half' ? 'Half day leave' : 'On leave'}</Chip></span>;
}
