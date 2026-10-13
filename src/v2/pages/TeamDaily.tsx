import { useMemo, useState, type ReactNode } from 'react';
import { MessageSquareText, Moon, Sunrise, CalendarCheck2, CalendarRange } from 'lucide-react';
import { PEOPLE, weekStartOf } from '../data';
import { dailyCounts, dayTime, TEAM_IDS, weekTime, weeklyCounts } from '../analytics';
import { nameOf, useStore } from '../store';
import { Avatar, Bar, Card, Chip, cx } from '../ui';
import DayTaskLog from './DayTaskLog';
import WeekByProject from './WeekByProject';
import { DateNav, dayHhmm, dayRows, hhmm, HoursLine, lastWorkingDay, PendingHint, ReportTable, targetsMet, weekLabel, weekRows, type Hours, type TvRow } from './DailyViews';

type View = 'daily' | 'weekly';
type Filter = 'all' | 'targets' | 'sent';

/** One of the two KPI tiles; clicking it shows only the people still pending (click again for everyone). */
function KpiTile({ icon, label, done, total, active, onClick }: { icon: ReactNode; label: string; done: number; total: number; active: boolean; onClick: () => void }) {
  const pending = total - done;
  return (
    <button aria-pressed={active} onClick={onClick} data-testid="kpi-tile"
      className={cx('focus-ring rounded-card border-2 bg-surface p-4 text-left shadow-soft transition', active ? 'border-accent' : 'border-transparent hover:border-line')}>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-muted">{icon}{label}</span>
        <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold', pending ? 'bg-butter text-butter-ink' : 'bg-mint text-mint-ink')}>{pending ? `${pending} pending` : 'Everyone in'}</span>
      </span>
      <span className="mt-1 block text-3xl font-extrabold tabular-nums" data-testid="kpi-value">{done}/{total}</span>
      <span className="mt-2 block"><Bar value={done} max={total} tone={pending ? 'sky' : 'mint'} /></span>
      <span className="mt-2 block text-xs text-muted">{active ? 'Showing who is pending. Click again to show everyone.' : pending ? 'Click to see who is pending' : 'Nobody is pending'}</span>
    </button>
  );
}

interface PersonRow { id: string; name: string; title: string; rows: TvRow[]; sent: boolean; targetsAt?: string; sentAt?: string; hours: Hours; note?: string }

/** One compact card per person: status, target vs actual table, hours on one line and the note on one line. */
function PersonCard({ r, view }: { r: PersonRow; view: View }) {
  const met = targetsMet(r.rows);
  const status = r.sentAt
    ? <Chip tone="mint">{view === 'daily' ? `End of day sent ${hhmm(r.sentAt)}` : `End of week sent ${dayHhmm(r.sentAt)}`}</Chip>
    : r.targetsAt
      ? <Chip tone="sky">{view === 'daily' ? `Targets set ${hhmm(r.targetsAt)}` : `Targets set ${dayHhmm(r.targetsAt)}`}</Chip>
      : <Chip tone="grey">Pending</Chip>;
  return (
    <section aria-label={`${r.name} update`} data-person={r.id} className="flex min-w-0 flex-col rounded-card bg-surface shadow-soft">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Avatar id={r.id} />
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{r.name}</p><p className="text-xs text-muted">{r.title}</p></div>
        <span data-testid="status">{status}</span>
      </div>
      <div className="flex-1 space-y-2 px-4 py-3">
        <ReportTable rows={r.rows} showActual label={`${r.name} targets vs actuals`} empty={view === 'daily' ? 'No tasks or targets for this day.' : 'No tasks or targets this week.'} />
        {r.sent && met.total > 0 && <p className="text-xs text-muted" data-testid="met"><b className="text-ink">{met.met} of {met.total}</b> targets met</p>}
        {!r.sent && r.rows.length > 0 && <PendingHint>{view === 'daily' ? 'Actual fills in when the end of day is sent' : 'Actual fills in when the end of week is sent'}</PendingHint>}
      </div>
      <div className="space-y-1 rounded-b-card border-t border-line bg-surface-2/50 px-4 py-2.5">
        <HoursLine t={r.hours} sent={r.sent} />
        <p className="flex items-center gap-1.5 text-sm" data-testid="note">
          <MessageSquareText size={13} className="shrink-0 text-muted" />
          {r.note?.trim() ? <span className="truncate" title={r.note}>{r.note}</span> : <span className="text-muted">No note</span>}
        </p>
      </div>
    </section>
  );
}

/** Managers and founders: everyone's targets against their end-of-day (or end-of-week) actuals. */
export default function TeamDaily() {
  const { daily, weekly, tasks, projects } = useStore();
  useStore((s) => s.profiles); // names can change
  const [view, setView] = useState<View>('daily');
  const [date, setDate] = useState(lastWorkingDay);
  const [layout, setLayout] = useState<'cards' | 'sheets'>('sheets');
  const [filter, setFilter] = useState<Filter>('all');
  const mon = weekStartOf(date);
  const team = useMemo(() => [...TEAM_IDS].sort((a, b) => nameOf(a).localeCompare(nameOf(b))), []);

  const people: PersonRow[] = useMemo(() => team.map((id) => {
    const p = PEOPLE.find((x) => x.id === id)!;
    if (view === 'daily') {
      const d = daily[`${id}|${date}`];
      const { rows, sent } = dayRows(tasks, projects, id, date, d);
      return { id, name: nameOf(id), title: p.title, rows, sent, targetsAt: d?.sodAt, sentAt: d?.eodAt, hours: dayTime(d), note: (sent ? d?.eodNote : d?.sodNote) || d?.sodNote };
    }
    const w = weekly[`${id}|${mon}`];
    const { rows, sent } = weekRows(tasks, id, mon, w);
    const wt = weekTime(daily, id, mon);
    return { id, name: nameOf(id), title: p.title, rows, sent, targetsAt: w?.targetsAt, sentAt: w?.eowAt, hours: wt, note: (sent ? w?.eowNote : w?.targetsNote) || w?.targetsNote };
  }), [team, view, daily, weekly, tasks, projects, date, mon]);

  const dc = dailyCounts({ daily }, date, team);
  const wc = weeklyCounts({ weekly }, mon, team);
  const counts = view === 'daily' ? { targets: dc.targetsSet, sent: dc.eodSent, total: dc.total } : { targets: wc.targetsSet, sent: wc.eowSent, total: wc.total };
  const shown = people.filter((r) => (filter === 'targets' ? !r.targetsAt : filter === 'sent' ? !r.sentAt : true));
  const toggle = (f: Filter) => setFilter((x) => (x === f ? 'all' : f));
  const switchView = (v: View) => { setView(v); setFilter('all'); };
  const what = view === 'daily'
    ? { targets: 'Set morning targets', sent: 'Sent end of day', pendingT: "haven't set morning targets", pendingS: "haven't sent end of day" }
    : { targets: 'Set weekly targets', sent: 'Sent end of week', pendingT: "haven't set weekly targets", pendingS: "haven't sent end of week" };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-[16rem] flex-1">
          <h1 className="text-2xl font-bold">Team tasks update</h1>
          <p className="text-sm text-muted">{view === 'daily' ? 'Morning targets against end-of-day actuals, for everyone.' : `Weekly targets against end-of-week actuals · ${weekLabel(mon)}`}</p>
        </div>
        <DateNav date={date} onChange={setDate} mode={view === 'daily' ? 'day' : 'week'} />
      </div>

      <div className="flex w-fit rounded-full bg-surface-2 p-1" role="tablist" aria-label="Daily or weekly">
        {(['daily', 'weekly'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => switchView(v)} className={cx('focus-ring rounded-full px-5 py-1.5 text-sm font-semibold', view === v ? 'bg-accent text-accent-on shadow-soft' : 'text-muted')}>{v === 'daily' ? 'Daily' : 'Weekly'}</button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <KpiTile icon={view === 'daily' ? <Sunrise size={16} className="text-butter-ink" /> : <CalendarRange size={16} className="text-sky-ink" />} label={what.targets} done={counts.targets} total={counts.total} active={filter === 'targets'} onClick={() => toggle('targets')} />
        <KpiTile icon={view === 'daily' ? <Moon size={16} className="text-accent-ink" /> : <CalendarCheck2 size={16} className="text-mint-ink" />} label={what.sent} done={counts.sent} total={counts.total} active={filter === 'sent'} onClick={() => toggle('sent')} />
      </div>

      {filter !== 'all' && (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-testid="filter-note">
          <span className="text-muted">Showing {shown.length} {shown.length === 1 ? 'person who' : 'people who'} {filter === 'targets' ? what.pendingT : what.pendingS}.</span>
          <button className="focus-ring rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-accent-ink" onClick={() => setFilter('all')}>Show everyone</button>
        </p>
      )}

      {shown.length === 0 && <Card><p className="py-6 text-center text-muted">Everyone is in ✓</p></Card>}
      {<div className="flex w-fit rounded-full bg-surface-2 p-1" role="tablist" aria-label="Cards or sheets">
        {(['cards', 'sheets'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={layout === v} onClick={() => setLayout(v)} className={cx('focus-ring rounded-full px-4 py-1 text-xs font-semibold', layout === v ? 'bg-surface text-ink shadow-soft' : 'text-muted')}>{v === 'cards' ? 'Summary cards' : 'Task updates'}</button>
        ))}
      </div>}
      {layout === 'cards' ? (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          {shown.map((r) => <PersonCard key={r.id} r={r} view={view} />)}
        </div>
      ) : (
        <div className="space-y-5">
          {shown.map((r) => (
            <div key={r.id} className="space-y-2" data-person-sheet={r.id}>
              <p className="flex items-center gap-2 font-bold"><Avatar id={r.id} size="sm" />{r.name}<span className="text-xs font-normal text-muted">{r.title}</span></p>
              {view === 'daily' ? <DayTaskLog personId={r.id} date={date} readOnly /> : <WeekByProject personId={r.id} date={date} readOnly />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
