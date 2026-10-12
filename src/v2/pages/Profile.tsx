import { useMemo, useRef, useState } from 'react';
import { Camera, Moon, Sun, Trash2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from '@/components';
import { useChartColors } from '@/theme/useChartColors';
import { dailyHistory, PEOPLE } from '../data';
import { first, nameOf, useStore } from '../store';
import { Avatar, Btn, Card, Chip, H2, ago, cx, input } from '../ui';
import { TaskCalendar } from './Widgets';

const BADGES = ['🚀', '⭐', '🔥', '🎯', '💡', '🌱', '☕', '🎧', '🏆', '🦉'];
const ACCENTS = [
  { id: 'brand', label: 'Lead Strategus', swatch: '#1D3FA0' },
  { id: 'sky', label: 'Sky', swatch: '#2563A8' },
  { id: 'mint', label: 'Mint', swatch: '#1A7F5A' },
  { id: 'lavender', label: 'Lavender', swatch: '#6D4FD1' },
  { id: 'peach', label: 'Peach', swatch: '#B04E24' },
  { id: 'butter', label: 'Butter', swatch: '#856300' },
];
const RANGES = [
  { id: 1, label: 'Last day' },
  { id: 5, label: 'Last week' },
  { id: 22, label: 'Last month' },
] as const;

/** Shrink an uploaded photo so it fits comfortably in local storage. */
function resize(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('That image is over 8 MB — try a smaller one.'));
    const img = new Image();
    img.onload = () => {
      const size = 160;
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      if (!ctx) return reject(new Error('Could not read that image.'));
      const s = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = URL.createObjectURL(file);
  });
}

export default function Profile() {
  const { me, tasks, profiles, setProfile } = useStore();
  const person = PEOPLE.find((p) => p.id === me)!;
  const prof = profiles[me] ?? {};
  const [name, setName] = useState(prof.name ?? person.name);
  const [range, setRange] = useState<number>(5);
  const fileRef = useRef<HTMLInputElement>(null);
  const colors = useChartColors();

  const days = useMemo(() => dailyHistory(person, 30), [person]);
  const shown = days.slice(-range);
  const avg = (k: 'onTime' | 'tasks' | 'hours') => (shown.length ? Math.round((shown.reduce((s, d) => s + d[k], 0) / shown.length) * 10) / 10 : 0);
  const mine = tasks.filter((t) => t.assigneeId === me).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reviewed = tasks.flatMap((t) => t.reviews.filter((r) => r.by === me).map((r) => ({ t, r }))).sort((a, b) => b.r.at.localeCompare(a.r.at));
  const assigned = tasks.filter((t) => t.assignedById === me);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Profile</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <H2>You</H2>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar id={me} size="xl" />
            <div className="flex flex-col gap-2">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  setProfile(me, { photo: await resize(f) });
                  toast({ title: 'Profile picture updated', tone: 'success' });
                } catch (err) {
                  toast({ title: err instanceof Error ? err.message : 'Upload failed', tone: 'info', emoji: '⚠️' });
                }
              }} />
              <Btn tone="soft" onClick={() => fileRef.current?.click()}><Camera size={14} /> {prof.photo ? 'Change photo' : 'Upload photo'}</Btn>
              {prof.photo && <Btn tone="ghost" className="border border-line" onClick={() => setProfile(me, { photo: undefined })}><Trash2 size={14} /> Remove photo</Btn>}
            </div>
          </div>
          <p className="mb-1.5 mt-5 text-xs font-bold uppercase text-muted">Badge</p>
          <div className="flex flex-wrap gap-1.5">
            <button className={cx('focus-ring h-9 rounded-xl border px-2 text-xs', !prof.emoji ? 'border-accent bg-accent-soft' : 'border-line')} onClick={() => setProfile(me, { emoji: undefined })}>None</button>
            {BADGES.map((b) => (
              <button key={b} aria-label={`Badge ${b}`} className={cx('focus-ring h-9 w-9 rounded-xl border text-lg', prof.emoji === b ? 'border-accent bg-accent-soft' : 'border-line')} onClick={() => setProfile(me, { emoji: b })}>{b}</button>
            ))}
          </div>
          <form className="mt-5" onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return toast({ title: 'Name cannot be empty', tone: 'info', emoji: '⚠️' });
            setProfile(me, { name: name.trim() });
            toast({ title: 'Name updated', tone: 'success' });
          }}>
            <label className="text-xs font-bold uppercase text-muted">Display name</label>
            <div className="mt-1.5 flex gap-2">
              <input className={input} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
              <Btn type="submit">Save</Btn>
            </div>
            <p className="mt-1.5 text-xs text-muted">{person.title}</p>
          </form>
        </Card>

        <Card>
          <H2>Theme</H2>
          <p className="mb-1.5 text-xs font-bold uppercase text-muted">Mode</p>
          <div className="flex gap-2">
            <Btn tone={!prof.dark ? 'primary' : 'ghost'} className="border border-line" onClick={() => setProfile(me, { dark: false, theme: 'pro' })}><Sun size={14} /> Light</Btn>
            <Btn tone={prof.dark ? 'primary' : 'ghost'} className="border border-line" onClick={() => setProfile(me, { dark: true, theme: 'dark' })}><Moon size={14} /> Dark</Btn>
          </div>
          <p className="mb-1.5 mt-5 text-xs font-bold uppercase text-muted">Accent colour</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACCENTS.map((a) => (
              <button key={a.id} onClick={() => setProfile(me, { accent: a.id, theme: prof.dark ? 'dark' : 'pro' })} className={cx('focus-ring flex items-center gap-2 rounded-xl border p-2 text-sm', (prof.accent ?? 'brand') === a.id ? 'border-accent bg-accent-soft font-semibold' : 'border-line')}>
                <span className="h-5 w-5 rounded-full" style={{ background: a.swatch }} /> {a.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Saved for {first(me)} only — everyone can pick their own.</p>
        </Card>
      </div>

      <Card>
        <H2 right={
          <div className="flex rounded-full bg-surface-2 p-0.5" role="radiogroup" aria-label="Range">
            {RANGES.map((r) => (
              <button key={r.id} role="radio" aria-checked={range === r.id} onClick={() => setRange(r.id)} className={cx('focus-ring rounded-full px-3 py-1 text-xs font-semibold', range === r.id ? 'bg-accent text-accent-on' : 'text-muted')}>{r.label}</button>
            ))}
          </div>
        }>My performance</H2>
        {days.length ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[['Tasks on time', `${avg('onTime')}%`], ['Tasks done / day', avg('tasks')], ['Hours / day', `${avg('hours')}h`]].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl bg-surface-2 p-3"><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted">{l}</p></div>
              ))}
            </div>
            {range > 1 && (
              <div className="mt-4 h-52">
                <ResponsiveContainer>
                  <LineChart data={shown.map((d) => ({ d: d.date.slice(5), v: d.onTime }))} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={colors.line} vertical={false} />
                    <XAxis dataKey="d" stroke={colors.muted} fontSize={12} />
                    <YAxis domain={[0, 100]} stroke={colors.muted} fontSize={12} unit="%" />
                    <Tooltip formatter={(v) => [`${v}%`, 'On time']} />
                    <ReferenceLine y={80} stroke={colors.muted} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="v" stroke={colors.accent} strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-left text-xs uppercase text-muted"><tr><th className="px-3 py-2">Date</th><th>On time</th><th>Tasks done</th><th>Hours</th></tr></thead>
                <tbody>
                  {[...shown].reverse().map((d) => (
                    <tr key={d.date} className="border-t border-line">
                      <td className="px-3 py-1.5">{new Date(d.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td className={cx('font-semibold', d.onTime >= 80 ? 'text-mint-ink' : 'text-butter-ink')}>{d.onTime}%</td>
                      <td>{d.tasks}</td><td>{d.hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-surface-2 p-3"><p className="text-2xl font-bold">{reviewed.length}</p><p className="text-xs text-muted">Reviews completed</p></div>
            <div className="rounded-2xl bg-surface-2 p-3"><p className="text-2xl font-bold">{assigned.length}</p><p className="text-xs text-muted">Tasks assigned</p></div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <H2>My task log</H2>
          <TaskCalendar tasks={mine} who="assignee" />
        </Card>
        <Card>
          <H2>My review log</H2>
          {reviewed.length === 0 ? <p className="text-sm text-muted">You haven't reviewed anything yet.</p> : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {reviewed.map(({ t, r }, i) => (
                <li key={t.id + i} className="flex items-center gap-3 py-2 text-sm">
                  <Avatar id={t.assigneeId} size="sm" />
                  <span className="min-w-0 flex-1"><span className="first-letter:uppercase">{t.title}</span><span className="block text-xs text-muted">{nameOf(t.assigneeId)} · {ago(r.at)}</span></span>
                  <Chip tone={r.verdict === 'approved' ? 'mint' : 'butter'}>{r.verdict === 'approved' ? 'Approved' : 'Feedback'}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
