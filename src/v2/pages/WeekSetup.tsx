import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Wand2, X } from 'lucide-react';
import { toast } from '@/components';
import { day, fmtDay, monToFriWeeks, MONTHS, parseDay, projectWeeks, type CustomWeek, type Project, type TextTarget } from '../data';
import { useStore } from '../store';
import { Btn, Chip, cx, safe } from '../ui';

const WEEK_COLORS = ['#1D3FA0', '#0E9F6E', '#D97706', '#7C3AED', '#DC2626', '#0891B2'];
const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * Set the project's weeks on a calendar: click the first day of a week, then its last day.
 * Click a day inside a week to select it (and remove it). "Mon to Fri for the whole project" fills it in one go.
 */
export function WeekCalendar({ p }: { p: Project }) {
  const setCustomWeeks = useStore((s) => s.setCustomWeeks);
  const weeks = useMemo(() => [...(p.customWeeks ?? [])].sort((a, b) => a.start.localeCompare(b.start)), [p.customWeeks]);
  const first = weeks[0]?.start ?? (p.startDate > day(0) ? p.startDate : day(0));
  const [view, setView] = useState(() => ({ y: parseDay(first).getFullYear(), m: parseDay(first).getMonth() }));
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const weekOf = (d: string) => weeks.findIndex((w) => w.start <= d && d <= w.end);
  const save = (next: CustomWeek[], msg: string) => { if (safe(() => setCustomWeeks(p.id, next))) toast({ title: msg, tone: 'success' }); };

  const click = (d: string) => {
    const wi = weekOf(d);
    if (!pending && wi >= 0) { setPicked(weeks[wi].start); return; }
    setPicked(null);
    if (!pending) { setPending(d); return; }
    const [s, e] = pending <= d ? [pending, d] : [d, pending];
    setPending(null);
    if (weeks.some((w) => w.start <= e && s <= w.end)) { toast({ title: 'Those days overlap another week. Pick free days.', tone: 'error' }); return; }
    save([...weeks, { start: s, end: e }], `Week added: ${fmtDay(s)} to ${fmtDay(e)}`);
  };
  const fillMonFri = () => {
    if (!p.startDate || !p.endDate) { toast({ title: 'The project needs a start and end date first', tone: 'error' }); return; }
    const out = monToFriWeeks(p.startDate, p.endDate);
    save(out, `${out.length} weeks set, Monday to Friday`);
  };

  // Month grid starting on Monday.
  const firstDow = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn }, (_, i) => iso(view.y, view.m, i + 1))];
  const shift = (n: number) => setView((v) => { const m = v.m + n; return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 }; });
  const range = pending && hover ? (pending <= hover ? [pending, hover] : [hover, pending]) : null;
  const pickedWeek = weeks.find((w) => w.start === picked);

  return (
    <div className="rounded-2xl border border-line p-4" data-testid="week-calendar">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-bold"><CalendarDays size={16} className="text-accent-ink" /> Project weeks</p>
          <p className="text-xs text-muted">Click the first day of a week, then its last day. Click a coloured day to select that week.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn tone="ghost" className="border border-line" onClick={fillMonFri}><Wand2 size={13} /> Mon to Fri for the whole project</Btn>
          {weeks.length > 0 && <Btn tone="ghost" onClick={() => { if (window.confirm('Remove all the weeks?')) save([], 'Weeks cleared'); }}>Clear all</Btn>}
        </div>
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <button aria-label="Previous month" className="focus-ring rounded-lg p-1.5 hover:bg-surface-2" onClick={() => shift(-1)}><ChevronLeft size={16} /></button>
            <p className="text-sm font-bold" data-testid="cal-month">{MONTHS[view.m]} {view.y}</p>
            <button aria-label="Next month" className="focus-ring rounded-lg p-1.5 hover:bg-surface-2" onClick={() => shift(1)}><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted">{WD.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1" onMouseLeave={() => setHover(null)}>
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`} />;
              const wi = weekOf(d);
              const color = wi >= 0 ? WEEK_COLORS[wi % WEEK_COLORS.length] : undefined;
              const inRange = range && d >= range[0] && d <= range[1];
              const outside = (p.startDate && d < p.startDate) || (p.endDate && d > p.endDate);
              const weekend = [0, 6].includes(parseDay(d).getDay());
              const isStart = wi >= 0 && weeks[wi].start === d;
              return (
                <motion.button key={d} data-day={d} whileTap={{ scale: 0.9 }} onClick={() => click(d)} onMouseEnter={() => setHover(d)}
                  title={wi >= 0 ? `Week ${wi + 1}: ${fmtDay(weeks[wi].start)} to ${fmtDay(weeks[wi].end)}` : pending ? 'Click to end the week here' : 'Click to start a week here'}
                  className={cx('focus-ring relative h-9 rounded-lg text-xs font-semibold tabular-nums transition-colors',
                    color ? 'text-white' : inRange ? 'bg-accent-soft text-accent-ink' : weekend ? 'text-faint hover:bg-surface-2' : 'text-ink hover:bg-surface-2',
                    outside && !color && 'opacity-40', pending === d && 'ring-2 ring-accent', picked && wi >= 0 && weeks[wi].start === picked && 'ring-2 ring-offset-1 ring-ink/60', d === day(0) && !color && 'border border-accent/50')}
                  style={color ? { background: color } : undefined}>
                  {parseDay(d).getDate()}
                  {isStart && <span className="absolute -top-1 -right-1 rounded-full bg-surface px-1 text-[8px] font-bold text-ink shadow-soft">W{wi + 1}</span>}
                </motion.button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted">{pending ? <>Week starts {fmtDay(pending)}. Now click its last day. <button className="font-semibold text-accent-ink hover:underline" onClick={() => setPending(null)}>Cancel</button></> : `Project runs ${p.startDate ? fmtDay(p.startDate) : '?'} to ${p.endDate ? fmtDay(p.endDate) : '?'}.`}</p>
        </div>

        <div>
          <AnimatePresence>
            {pickedWeek && (
              <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <b>Week {weeks.indexOf(pickedWeek) + 1}</b> {fmtDay(pickedWeek.start)} to {fmtDay(pickedWeek.end)}
                <Btn tone="ghost" className="ml-auto text-coral-ink" onClick={() => { save(weeks.filter((w) => w !== pickedWeek), 'Week removed'); setPicked(null); }}><Trash2 size={13} /> Remove</Btn>
                <button aria-label="Close" className="rounded p-1 text-muted hover:text-ink" onClick={() => setPicked(null)}><X size={14} /></button>
              </motion.div>
            )}
          </AnimatePresence>
          {weeks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">No weeks set yet, so weeks are 7-day blocks from the start date. Set them on the calendar, or use Mon to Fri for the whole project.</p>
          ) : (
            <ul className="flex max-h-72 flex-wrap content-start gap-1.5 overflow-y-auto" aria-label="Weeks">
              {weeks.map((w, i) => (
                <li key={w.start}>
                  <button onClick={() => { setPicked(w.start); setView({ y: parseDay(w.start).getFullYear(), m: parseDay(w.start).getMonth() }); }}
                    className={cx('focus-ring flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs', picked === w.start ? 'border-ink/50 bg-surface-2' : 'border-line bg-surface')}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: WEEK_COLORS[i % WEEK_COLORS.length] }} />
                    <b>W{i + 1}</b> {fmtDay(w.start)} to {fmtDay(w.end)}{w.start <= day(0) && day(0) <= w.end && <Chip tone="sky">now</Chip>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Written targets for a week (for anything that is not a number). Managers set the target; actuals can be filled in later. */
export function WeekTextTargets({ p, ws, canEdit, mode }: { p: Project; ws: string; canEdit: boolean; mode: 'target' | 'actual' }) {
  const setWeekText = useStore((s) => s.setWeekText);
  const rows = p.weekText?.[ws] ?? [];
  const [draft, setDraft] = useState<TextTarget[] | null>(null);
  const list = draft ?? rows;
  const week = projectWeeks(p).find((w) => w.start === ws);
  const editing = !!draft;
  const upd = (id: string, patch: Partial<TextTarget>) => setDraft((d) => (d ?? rows).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const saveAll = () => { if (safe(() => setWeekText(p.id, ws, list))) { setDraft(null); toast({ title: 'Written targets saved', tone: 'success' }); } };
  const field = 'focus-ring w-full rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink';
  return (
    <div className="rounded-2xl border border-line p-4" data-testid={`text-targets-${mode}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">📝 Written targets {week ? <span className="font-normal text-muted">· Week {week.n}</span> : null}</p>
          <p className="text-xs text-muted">{mode === 'target' ? 'For targets that are not a number, e.g. "Launch the new email sequence".' : 'How the written targets for this week are going.'}</p>
        </div>
        {canEdit && (editing
          ? <span className="flex gap-2"><Btn tone="ghost" onClick={() => setDraft(null)}>Cancel</Btn><Btn onClick={saveAll}>Save</Btn></span>
          : <Btn tone="ghost" className="border border-line" onClick={() => setDraft(rows.length ? rows : [{ id: `tt${Date.now().toString(36)}`, label: '', target: '' }])}>{rows.length ? 'Edit' : <><Plus size={13} /> Add written target</>}</Btn>)}
      </div>
      {list.length === 0 ? <p className="mt-2 text-xs text-muted">None for this week.</p> : (
        <table className="mt-3 w-full text-sm">
          <thead><tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted"><th className="w-1/4 pb-1">What</th><th className="pb-1">Target</th><th className="pb-1">Actual</th>{editing && <th className="w-8" />}</tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t border-line align-top" data-text-target={r.id}>
                <td className="py-1.5 pr-2">{editing && mode === 'target' ? <input aria-label="What" className={field} placeholder="e.g. Email sequence" value={r.label} onChange={(e) => upd(r.id, { label: e.target.value })} /> : <b>{r.label || '·'}</b>}</td>
                <td className="py-1.5 pr-2">{editing && mode === 'target' ? <input aria-label="Written target" className={field} placeholder="e.g. Launch v2 to 200 contacts" value={r.target} onChange={(e) => upd(r.id, { target: e.target.value })} /> : r.target || '·'}</td>
                <td className="py-1.5 pr-2">{editing ? <input aria-label="Written actual" className={field} placeholder="What happened" value={r.actual ?? ''} onChange={(e) => upd(r.id, { actual: e.target.value })} /> : <span className={r.actual ? '' : 'text-muted'}>{r.actual || 'Not updated yet'}</span>}</td>
                {editing && <td className="py-1.5">{mode === 'target' && <button aria-label="Remove written target" className="rounded p-1 text-muted hover:text-coral-ink" onClick={() => setDraft(list.filter((x) => x.id !== r.id))}><Trash2 size={13} /></button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && mode === 'target' && <button className="mt-2 flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-surface-2" onClick={() => setDraft([...list, { id: `tt${Date.now().toString(36)}${list.length}`, label: '', target: '' }])}><Plus size={12} /> Add another</button>}
    </div>
  );
}
