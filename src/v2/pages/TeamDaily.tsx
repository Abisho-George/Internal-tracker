import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Moon, Sunrise } from 'lucide-react';
import { day, isLeadRole, PEOPLE } from '../data';
import { emptyDaily, emptyWeekly, nameOf, useStore } from '../store';
import { SUBMITTED, TaskSummary, weekOf } from './TaskUpdateSections';
import { Avatar, Card, Chip, cx } from '../ui';
import { CustomBlocksView, CustomRowsView, NumbersView } from './DailyViews';
import { colorOf } from './Widgets';

/** Move n working days (weekends skipped) and never past today. */
const shift = (d: string, n: number) => {
  const x = new Date(d + 'T00:00');
  do x.setDate(x.getDate() + Math.sign(n)); while (x.getDay() === 0 || x.getDay() === 6);
  const out = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return out > day(0) ? day(0) : out;
};
const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
type Filter = 'all' | 'noTargets' | 'noEod';

/** Managers & founders: everyone's morning targets and evening report for a day, side by side. */
export default function TeamDaily() {
  const { daily, projects, tasks, weekly } = useStore();
  const [date, setDate] = useState(day(0));
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const [mon, fri] = weekOf(date);
  const [filter, setFilter] = useState<Filter>('all');
  const team = PEOPLE.filter((p) => !isLeadRole(p.role)).sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id)));
  const rows = team.map((p) => ({ p, d: daily[`${p.id}|${date}`] ?? emptyDaily() }));
  const setCount = rows.filter((r) => r.d.sodAt).length;
  const eodCount = rows.filter((r) => r.d.eodAt).length;
  const priority = rows.flatMap((r) => r.d.plan.filter((b) => b.custom?.priority)).length;
  const shown = rows.filter((r) => (filter === 'noTargets' ? !r.d.sodAt : filter === 'noEod' ? !r.d.eodAt : true));
  const isToday = date === day(0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team tasks update</h1>
          <p className="text-sm text-muted">{view === 'daily' ? 'Today’s targets and end-of-day updates from everyone.' : `Weekly targets and end-of-week updates · ${mon} → ${fri}`}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          <button aria-label="Previous day" className="focus-ring rounded-lg p-1.5 hover:bg-surface-2" onClick={() => setDate(shift(date, -1))}><ChevronLeft size={16} /></button>
          <label className="flex items-center gap-2 px-1 text-sm font-semibold"><CalendarDays size={15} /><input type="date" className="bg-transparent outline-none" value={date} max={day(0)} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
          <button aria-label="Next day" disabled={isToday} className="focus-ring rounded-lg p-1.5 hover:bg-surface-2 disabled:opacity-30" onClick={() => setDate(shift(date, 1))}><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex w-fit rounded-full bg-surface-2 p-1" role="tablist">
        {(['daily', 'weekly'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cx('focus-ring rounded-full px-5 py-1.5 text-sm font-semibold', view === v ? 'bg-accent text-accent-on shadow-soft' : 'text-muted')}>{v === 'daily' ? '☀️ Daily' : '📅 Weekly'}</button>
        ))}
      </div>

      {view === 'weekly' ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {team.map((p) => {
            const w = weekly[`${p.id}|${mon}`] ?? emptyWeekly();
            const wk = tasks.filter((t) => t.assigneeId === p.id && t.date >= mon && t.date <= fri);
            const sub = wk.filter(SUBMITTED);
            return (
              <Card key={p.id} className="p-0">
                <div className="flex items-center gap-3 border-b border-line px-5 py-3">
                  <Avatar id={p.id} />
                  <div className="min-w-0 flex-1"><p className="font-bold">{nameOf(p.id)}</p><p className="text-xs text-muted">{p.title}</p></div>
                  <Chip tone={w.targetsAt ? 'mint' : 'grey'}>📅 {w.targetsAt ? 'Targets set' : 'Pending'}</Chip>
                  <Chip tone={w.eowAt ? 'mint' : 'grey'}>🏁 {w.eowAt ? 'Week sent' : 'Pending'}</Chip>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase text-sky-ink">Weekly targets</p>
                    <TaskSummary tasks={wk} mode="assigned" />
                    {w.targetsNote && <p className="text-sm">“{w.targetsNote}”</p>}
                    <CustomRowsView rows={w.targetsCustom} />
                    {!w.targetsAt && !wk.length && <p className="text-sm text-muted">Nothing yet.</p>}
                  </div>
                  <div className="space-y-2 sm:border-l sm:border-line sm:pl-4">
                    <p className="text-xs font-bold uppercase text-mint-ink">End of week</p>
                    <TaskSummary tasks={sub} mode="submitted" />
                    {w.eowNote && <p className="text-sm">“{w.eowNote}”</p>}
                    <CustomRowsView rows={w.eowCustom} targets={w.targetsCustom} />
                    {!w.eowAt && <p className="text-sm text-muted">Not sent yet.</p>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (<>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { key: 'noTargets' as const, icon: '🌅', label: 'Set morning targets', value: `${setCount} / ${team.length}`, bg: 'from-amber-400 to-orange-500' },
          { key: 'noEod' as const, icon: '🌙', label: 'Sent end of day', value: `${eodCount} / ${team.length}`, bg: 'from-indigo-500 to-blue-700' },
          { key: 'all' as const, icon: '★', label: 'Priority blocks today', value: String(priority), bg: 'from-rose-500 to-red-600' },
        ].map((t) => (
          <div key={t.label} className={cx('rounded-card bg-gradient-to-br p-4 text-white shadow-soft', t.bg)}>
            <p className="text-sm font-semibold text-white/85">{t.icon} {t.label}</p>
            <p className="mt-1 text-3xl font-extrabold">{t.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Show">
        {([['all', 'Everyone'], ['noTargets', `Waiting for targets (${team.length - setCount})`], ['noEod', `Waiting for end of day (${team.length - eodCount})`]] as const).map(([k, l]) => (
          <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={cx('focus-ring rounded-full px-3 py-1.5 text-sm font-semibold', filter === k ? 'bg-accent text-accent-on' : 'bg-surface-2 text-muted')}>{l}</button>
        ))}
      </div>

      {shown.length === 0 && <Card><p className="py-6 text-center text-muted">Everyone's in ✓</p></Card>}
      <div className="grid gap-5 lg:grid-cols-2">
        {shown.map(({ p, d }) => (
          <Card key={p.id} className="p-0">
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <Avatar id={p.id} />
              <div className="min-w-0 flex-1"><p className="font-bold">{nameOf(p.id)}</p><p className="text-xs text-muted">{p.title}</p></div>
              <Chip tone={d.sodAt ? 'mint' : 'grey'}>🌅 {d.sodAt ? time(d.sodAt) : 'Pending'}</Chip>
              <Chip tone={d.eodAt ? 'mint' : 'grey'}>🌙 {d.eodAt ? time(d.eodAt) : 'Pending'}</Chip>
            </div>
            {d.plan.length > 0 && (
              <div className="flex h-2" title="Day plan">
                {d.plan.map((b) => <div key={b.id} style={{ flex: (+b.end.slice(0, 2) * 60 + +b.end.slice(3)) - (+b.start.slice(0, 2) * 60 + +b.start.slice(3)), background: b.custom ? (b.custom.priority ? '#DC2626' : '#64748B') : colorOf(projects, b.projectId) }} />)}
              </div>
            )}
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-butter-ink"><Sunrise size={14} /> Today's targets</p>
                <div className="mb-2"><TaskSummary tasks={tasks.filter((t) => t.assigneeId === p.id && t.date === date)} mode="assigned" /></div>
                {d.sodAt ? (
                  <div className="space-y-2">
                    {d.sodNote && <p className="text-sm">“{d.sodNote}”</p>}
                    <NumbersView numbers={d.sodTargets} empty="No number targets." />
                    <CustomRowsView rows={d.sodCustom} />
                    <CustomBlocksView plan={d.plan} />
                  </div>
                ) : <p className="text-sm text-muted">Not set yet.</p>}
              </div>
              <div className="sm:border-l sm:border-line sm:pl-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-accent-ink"><Moon size={14} /> End of day</p>
                <div className="mb-2"><TaskSummary tasks={tasks.filter((t) => t.assigneeId === p.id && t.date === date && SUBMITTED(t))} mode="submitted" /></div>
                {d.eodAt ? (
                  <div className="space-y-2">
                    {d.eodNote && <p className="text-sm">“{d.eodNote}”</p>}
                    <NumbersView numbers={d.eodActuals} targets={d.sodTargets} empty="No numbers reported." />
                    <CustomRowsView rows={d.eodCustom} targets={d.sodCustom} />
                    <CustomBlocksView plan={d.plan.filter((b) => b.custom?.achieved != null)} />
                  </div>
                ) : <p className="text-sm text-muted">{isToday ? 'Not sent yet.' : 'Not sent.'}</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>
      </>)}
    </div>
  );
}
