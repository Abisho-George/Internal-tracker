// Task history (resubmits, feedback rounds, timelines) and the period-by-period track table.
import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { isSubmitted, type Gran, type KpiValues } from '../../analytics';
import { fmtDay, isoDate, type Task, type TaskAction, type TaskEvent } from '../../data';
import { first, useStore } from '../../store';
import { Chip, STATUS, cx } from '../../ui';
import { KpiValue } from './controls';

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** "12 Oct, 10:05" in local time. */
export const stampOf = (iso: string) => { const d = new Date(iso); return `${fmtDay(isoDate(d))}, ${hhmm(d)}`; };

const ACTION: Record<TaskAction, { text: (e: TaskEvent) => string; dot: string }> = {
  assigned: { text: (e) => `Assigned by ${first(e.by)}${e.to ? ` to ${first(e.to)}` : ''}`, dot: 'bg-grey-strong' },
  submitted: { text: (e) => `Sent for approval${e.to ? ` to ${first(e.to)}` : ''}`, dot: 'bg-sky-strong' },
  resubmitted: { text: (e) => `Resubmitted${e.to ? ` to ${first(e.to)}` : ''}`, dot: 'bg-lavender-strong' },
  feedback: { text: (e) => `Feedback from ${first(e.by)}`, dot: 'bg-butter-strong' },
  forwarded: { text: (e) => `Forwarded by ${first(e.by)}${e.to ? ` to ${first(e.to)}` : ''}`, dot: 'bg-peach-strong' },
  approved: { text: (e) => `Approved by ${first(e.by)}`, dot: 'bg-mint-strong' },
  edited: { text: (e) => `Edited by ${first(e.by)}`, dot: 'bg-grey-strong' },
  reminded: { text: (e) => `Reminder from ${first(e.by)}`, dot: 'bg-grey-strong' },
};

/** Every recorded step of a task, oldest first, with times. */
export function TaskTimeline({ task }: { task: Task }) {
  const events = task.history ?? [];
  if (!events.length) return <p className="text-xs text-muted">No history recorded.</p>;
  return (
    <ol className="relative ml-1.5 space-y-2 border-l border-line pl-4" aria-label="Task history">
      {events.map((e, i) => (
        <li key={i} className="relative text-xs" data-action={e.action}>
          <span className={cx('absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-surface', ACTION[e.action]?.dot ?? 'bg-grey-strong')} />
          <span className="font-semibold text-ink">{ACTION[e.action]?.text(e) ?? e.action}</span>
          <span className="text-muted"> · {stampOf(e.at)}</span>
          {e.note && <span className="mt-0.5 block text-muted">"{e.note}"</span>}
        </li>
      ))}
    </ol>
  );
}

export const resubmitText = (n: number) => `Resubmitted ${n}x`;

interface HistoryStats { tasks: number; submitted: number; approved: number; feedback: number; resubmits: number; resubmitted: number; forwarded: number; firstTime: number | null; avgApprovalH: number | null }
function statsOf(list: Task[]): HistoryStats {
  let feedback = 0, forwarded = 0, approvalMs = 0, approvalN = 0, clean = 0;
  const approved = list.filter((t) => t.status === 'done');
  list.forEach((t) => {
    (t.history ?? []).forEach((e) => { if (e.action === 'feedback') feedback++; if (e.action === 'forwarded') forwarded++; });
    const sub = t.history?.find((e) => e.action === 'submitted')?.at;
    if (t.approvedAt && sub) { approvalMs += new Date(t.approvedAt).getTime() - new Date(sub).getTime(); approvalN++; }
  });
  approved.forEach((t) => { if (!(t.resubmits ?? 0) && !t.history?.some((e) => e.action === 'feedback')) clean++; });
  return {
    tasks: list.length, submitted: list.filter(isSubmitted).length, approved: approved.length, feedback, forwarded,
    resubmits: list.reduce((s, t) => s + (t.resubmits ?? 0), 0), resubmitted: list.filter((t) => (t.resubmits ?? 0) > 0).length,
    firstTime: approved.length ? Math.round((clean / approved.length) * 100) : null,
    avgApprovalH: approvalN ? Math.round((approvalMs / approvalN / 3600000) * 10) / 10 : null,
  };
}

/**
 * Task history for a person and period: counts (sent for approval, approved, feedback rounds, resubmits, approved first time,
 * time to approval), the all-time resubmit total, and the tasks that went back and forth with their timelines.
 */
export function TaskHistorySummary({ personId, from, to, periodTitle }: { personId: string; from: string; to: string; periodTitle: string }) {
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const mine = useMemo(() => tasks.filter((t) => t.assigneeId === personId), [tasks, personId]);
  const inRange = useMemo(() => mine.filter((t) => t.date >= from && t.date <= to), [mine, from, to]);
  const s = useMemo(() => statsOf(inRange), [inRange]);
  const total = useMemo(() => statsOf(mine), [mine]);
  const since = mine.reduce((m, t) => (t.date < m ? t.date : m), to);
  const bumpy = inRange.filter((t) => (t.resubmits ?? 0) > 0 || t.history?.some((e) => e.action === 'feedback'))
    .sort((a, b) => (b.resubmits ?? 0) - (a.resubmits ?? 0) || b.date.localeCompare(a.date));
  const shown = all ? bumpy : bumpy.slice(0, 5);
  const projName = (id: string) => projects.find((p) => p.id === id)?.name ?? id;
  const tiles: [string, string | number, string?][] = [
    ['Sent for approval', s.submitted, `${s.tasks} assigned`],
    ['Approved', s.approved],
    ['Feedback rounds', s.feedback],
    ['Resubmits', s.resubmits, s.resubmitted ? `on ${s.resubmitted} task${s.resubmitted === 1 ? '' : 's'}` : undefined],
    ['Approved first time', s.firstTime == null ? 'n/a' : `${s.firstTime}%`],
    ['Avg time to approval', s.avgApprovalH == null ? 'n/a' : `${s.avgApprovalH}h`],
  ];
  return (
    <div data-testid="task-history">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([l, v, sub]) => (
          <div key={l} className="min-w-0 rounded-xl bg-surface-2 px-3 py-2">
            <p className="text-lg font-bold leading-tight tabular-nums">{v}</p>
            <p className="truncate text-[11px] text-muted" title={l}>{l}{sub ? <span className="block">{sub}</span> : null}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted" data-testid="history-all-time">
        All history since {fmtDay(since)}: <b className="text-ink">{total.resubmits} resubmit{total.resubmits === 1 ? '' : 's'}</b> on {total.resubmitted} of {total.tasks} tasks
        {total.firstTime != null && <>, {total.firstTime}% approved first time</>}{total.forwarded ? <>, {total.forwarded} forwarded</> : null}.
      </p>
      <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-wide text-muted">Sent back and resubmitted, {periodTitle}</p>
      {bumpy.length === 0 ? (
        <p className="rounded-xl bg-surface-2 px-3 py-3 text-sm text-muted">{s.submitted ? 'No feedback rounds in this period: everything went through first time.' : 'Nothing sent for approval in this period yet.'}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {shown.map((t) => (
            <li key={t.id} className="px-3 py-2" data-task={t.id}>
              <button type="button" className="focus-ring flex w-full items-center gap-2 rounded-lg text-left text-sm" aria-expanded={open === t.id} onClick={() => setOpen(open === t.id ? null : t.id)}>
                {open === t.id ? <ChevronDown size={14} className="shrink-0 text-muted" /> : <ChevronRight size={14} className="shrink-0 text-muted" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate first-letter:uppercase">{t.title}</span>
                  <span className="block truncate text-xs text-muted">{fmtDay(t.date)} · {projName(t.projectId)}</span>
                </span>
                {(t.resubmits ?? 0) > 0 ? <Chip tone="butter">{resubmitText(t.resubmits)}</Chip> : <Chip tone="grey">Feedback</Chip>}
                <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
              </button>
              {open === t.id && <div className="mt-2 pl-6"><TaskTimeline task={t} /></div>}
            </li>
          ))}
        </ul>
      )}
      {bumpy.length > 5 && (
        <button type="button" className="focus-ring mt-2 rounded-lg text-xs font-semibold text-accent-ink hover:underline" onClick={() => setAll((v) => !v)}>
          {all ? 'Show fewer' : `Show all ${bumpy.length}`}
        </button>
      )}
    </div>
  );
}

export type TrackRow = { key: string; label: string; title: string; partial: boolean } & KpiValues;
const onTimeTone = (v: number | null) => (v == null ? '' : v >= 80 ? 'text-mint-ink' : v >= 60 ? 'text-butter-ink' : 'text-coral-ink');

/** Period-by-period numbers, newest first. The selected period is highlighted. Optional end-of-day column for days. */
export function TrackTable({ rows, gran, selectedKey, eodOf, maxHeight = 'max-h-64' }: { rows: TrackRow[]; gran: Gran; selectedKey?: string; eodOf?: (date: string) => string | null; maxHeight?: string }) {
  const showEod = gran === 'day' && !!eodOf;
  return (
    <div className={cx('overflow-auto rounded-xl border border-line', maxHeight)} data-testid="track-table">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-[1] bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-bold">{gran === 'day' ? 'Date' : gran === 'week' ? 'Week' : 'Month'}</th>
            <th className="px-2 py-2 text-right font-bold">On time</th>
            <th className="px-2 py-2 text-right font-bold">Tasks done</th>
            <th className="px-2 py-2 text-right font-bold">Hours</th>
            <th className="px-2 py-2 text-right font-bold">Extra</th>
            <th className="px-2 py-2 text-right font-bold">Resubmits</th>
            {showEod && <th className="px-3 py-2 font-bold">End of day</th>}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {[...rows].reverse().map((r) => {
            const eod = showEod ? eodOf!(r.key) : null;
            return (
              <tr key={r.key} className={cx('border-t border-line', r.key === selectedKey && 'bg-accent-soft/50')} aria-current={r.key === selectedKey ? 'true' : undefined}>
                <td className="whitespace-nowrap px-3 py-1.5">{r.title}{r.partial && <span className="ml-1 text-[11px] text-muted">(so far)</span>}</td>
                <td className={cx('px-2 py-1.5 text-right font-semibold', onTimeTone(r.onTime))}><KpiValue kpi="onTime" v={r.onTime} /></td>
                <td className="px-2 py-1.5 text-right">{r.tasks}</td>
                <td className="px-2 py-1.5 text-right">{r.hours}h</td>
                <td className="px-2 py-1.5 text-right">{r.extra ? `${r.extra}h` : '0h'}</td>
                <td className={cx('px-2 py-1.5 text-right', r.resubmits > 0 && 'font-semibold text-butter-ink')}>{r.resubmits}</td>
                {showEod && <td className="whitespace-nowrap px-3 py-1.5 text-xs">{eod == null ? <span className="text-faint">No record</span> : eod ? <span className="font-semibold text-mint-ink">Sent {eod}</span> : <span className="font-semibold text-butter-ink">{r.partial ? 'Not sent yet' : 'Not sent'}</span>}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** For the end-of-day column: "18:42" when sent, "" when a record exists but end of day was not sent, null when no record. */
export function useEodOf(personId: string): (date: string) => string | null {
  const daily = useStore((s) => s.daily);
  return useMemo(() => (date: string) => {
    const d = daily[`${personId}|${date}`];
    if (!d) return null;
    return d.eodAt ? hhmm(new Date(d.eodAt)) : '';
  }, [daily, personId]);
}
