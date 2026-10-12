import { useMemo, useRef, useState } from 'react';
import { Camera, Moon, Sun, Trash2 } from 'lucide-react';
import { toast } from '@/components';
import { personSeries, personSeriesAll, shiftPeriod, teamTable, type Gran, type Kpi } from '../analytics';
import { isLeadRole, PEOPLE } from '../data';
import { first, nameOf, useStore } from '../store';
import { Avatar, Btn, Card, Chip, H2, ago, cx, input } from '../ui';
import { TaskCalendar } from './Widgets';
import { AssignmentMix, KpiTrend, WhereTimeGoes } from './analytics/charts';
import { GranToggle, KpiPicker, KpiTiles, PeriodSelect, TRACK_TITLE, periodNoun, seriesLength, useEarliest, usePeriodOptions, useSlice } from './analytics/controls';
import { TaskHistorySummary, TrackTable, useEodOf } from './analytics/history';

const BADGES = ['🚀', '⭐', '🔥', '🎯', '💡', '🌱', '☕', '🎧', '🏆', '🦉'];
const ACCENTS = [
  { id: 'brand', label: 'Lead Strategus', swatch: '#1D3FA0' },
  { id: 'sky', label: 'Sky', swatch: '#2563A8' },
  { id: 'mint', label: 'Mint', swatch: '#1A7F5A' },
  { id: 'lavender', label: 'Lavender', swatch: '#6D4FD1' },
  { id: 'peach', label: 'Peach', swatch: '#B04E24' },
  { id: 'butter', label: 'Butter', swatch: '#856300' },
];

/** Shrink an uploaded photo so it fits comfortably in local storage. */
function resize(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    if (file.size > 8 * 1024 * 1024) return reject(new Error('That image is over 8 MB, please try a smaller one.'));
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
  const fileRef = useRef<HTMLInputElement>(null);
  const lead = isLeadRole(person.role);
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
          <p className="mt-3 text-xs text-muted">Saved for {first(me)} only. Everyone can pick their own.</p>
        </Card>
      </div>

      {lead ? (
        <Card>
          <H2>My activity</H2>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-surface-2 p-3"><p className="text-2xl font-bold">{reviewed.length}</p><p className="text-xs text-muted">Reviews completed</p></div>
            <div className="rounded-2xl bg-surface-2 p-3"><p className="text-2xl font-bold">{assigned.length}</p><p className="text-xs text-muted">Tasks assigned</p></div>
          </div>
          {assigned.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">How I assign vs standard time (all tasks)</p>
              <AssignmentMix from="0000-01-01" to="9999-12-31" assignedBy={me} />
            </div>
          )}
        </Card>
      ) : (
        <MyProgress me={me} />
      )}

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

/** My daily / weekly / monthly progress: KPI tiles vs the previous period, the line graph, my track, where my time goes and my task history. */
function MyProgress({ me }: { me: string }) {
  const slice = useSlice();
  const earliest = useEarliest();
  const [gran, setGran] = useState<Gran>('day');
  const [kpi, setKpi] = useState<Kpi>('onTime');
  const [idx, setIdx] = useState(0);
  const options = usePeriodOptions(gran, earliest);
  const i = Math.min(idx, options.length - 1);
  const period = options[i].period;
  const prev = shiftPeriod(period, -1);
  const monthsAvail = usePeriodOptions('month', earliest).length;
  const n = seriesLength(gran, monthsAvail);
  const row = useMemo(() => teamTable(slice, gran, period.key, { people: [me] })[0], [slice, gran, period.key, me]);
  const points = useMemo(() => personSeries(slice, me, gran, kpi, n), [slice, me, gran, kpi, n]);
  const track = useMemo(() => personSeriesAll(slice, me, gran, n), [slice, me, gran, n]);
  const eodOf = useEodOf(me);
  const assignedHere = slice.tasks.some((t) => t.assignedById === me && t.date >= period.from && t.date <= period.to);
  const noun = periodNoun(gran);

  return (
    <>
      <Card>
        <div data-testid="my-progress">
          <H2 right={<GranToggle value={gran} onChange={setGran} />}>My progress</H2>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <KpiPicker value={kpi} onChange={setKpi} />
            <span className="ml-auto"><PeriodSelect options={options} index={i} onChange={setIdx} /></span>
          </div>
          {row && <KpiTiles cur={row} prev={row.prev} selected={kpi} prevLabel={`Previous ${noun}: ${prev.title}`} onSelect={setKpi} />}
          <p className="mt-2 text-xs text-muted">{period.title}{period.partial ? ' (so far)' : ''} compared with the previous {noun}, {prev.title}.</p>
          <div className="mt-4">
            <KpiTrend points={points} kpi={kpi} selectedKey={period.key} height={220} />
            <p className="mt-1 text-[11px] text-muted">{kpi === 'onTime' ? 'Dashed line: 80% goal. ' : ''}Ringed dot: the selected {noun}. Hollow dot: still in progress.</p>
          </div>
          <p className="mb-2 mt-4 text-sm font-bold">{TRACK_TITLE[gran]}</p>
          <TrackTable rows={track} gran={gran} selectedKey={period.key} eodOf={eodOf} maxHeight="max-h-56" />
        </div>
      </Card>

      <Card>
        <H2 right={<span className="text-xs text-muted">{period.title}</span>}>Where my time goes</H2>
        <WhereTimeGoes personId={me} from={period.from} to={period.to} emptyText={`No time recorded for ${period.title} yet.`} />
      </Card>

      {assignedHere && (
        <Card>
          <H2 right={<span className="text-xs text-muted">Tasks I assigned for {period.title}</span>}>How I assign vs standard time</H2>
          <AssignmentMix from={period.from} to={period.to} assignedBy={me} />
        </Card>
      )}

      <Card>
        <H2 right={<span className="text-xs text-muted">{period.title}</span>}>My task history</H2>
        <TaskHistorySummary personId={me} from={period.from} to={period.to} periodTitle={period.title} />
      </Card>
    </>
  );
}
