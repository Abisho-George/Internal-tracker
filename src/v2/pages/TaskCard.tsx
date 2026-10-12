import { useState } from 'react';
import { BellRing, Check, CheckCheck, ChevronDown, Forward, Gauge, History, MessageSquare, Pencil, Repeat, Send, Star, UserPlus } from 'lucide-react';
import { Modal, toast } from '@/components';
import { day, fmtDay, MONTHS, PEOPLE, TASK_TYPES, type Task, type TaskAction, type TaskEvent } from '../data';
import { difficulty, DIFFICULTY_LABEL, type Difficulty } from '../analytics';
import { first, nameOf, paceMinutes, useStore } from '../store';
import { Avatar, Btn, Chip, STATUS, cx, fmtMin, input, safe } from '../ui';

// ---------------------------------------------------------------------------------------------
// Small shared pieces: times, pace, difficulty, resubmits
// ---------------------------------------------------------------------------------------------

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const two = (n: number) => String(n).padStart(2, '0');
/** "Mon 12 Oct, 10:42" (local, 24h): the exact time of a task event. */
export function fmtStamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${WD[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}
/** "10:42" for today, otherwise "Fri 9 Oct, 10:42". */
export function shortStamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
  return local === day(0) ? `${two(d.getHours())}:${two(d.getMinutes())}` : fmtStamp(iso);
}
const span = (fromIso: string, toIso: string) => fmtMin(Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000)));

/** "5m faster than target" / "12m over target": plain words instead of a ratio. */
export function PaceChip({ task }: { task: Task }) {
  const d = paceMinutes(task);
  if (d == null) return null;
  if (d >= 0) return <Chip tone="mint">✓ On time{d > 0 ? ` · ${fmtMin(d)} faster` : ''}</Chip>;
  return <Chip tone="butter">{fmtMin(-d)} over target</Chip>;
}

/** Chip colour per difficulty level: standard sky, easy butter, challenging coral. */
export const DIFFICULTY_TONE: Record<Difficulty, string> = { standard: 'sky', easy: 'butter', challenging: 'coral' };
/** "Standard", "Easy (+25% time)", "Challenging (-20% time)". */
export function difficultyLabel(d: { level: Difficulty; pct: number }): string {
  if (d.level === 'standard') return 'Standard';
  return `${DIFFICULTY_LABEL[d.level]} (${d.pct > 0 ? '+' : ''}${d.pct}% time)`;
}
/** The standard minutes a task is measured against, or null for a custom task with no project standard. */
export function taskStandard(t: Pick<Task, 'typeId' | 'customStandardId' | 'standardMinutes'>): number | null {
  if (t.typeId === 'custom' && !t.customStandardId) return null;
  return t.standardMinutes && t.standardMinutes > 0 ? t.standardMinutes : null;
}

/**
 * Target time vs the project's standard time: "Challenging (-20% time) · standard 1h".
 * standard = null means there is no standard to compare with (a free-form custom task).
 */
export function DifficultyBadge({ target, standard, showStandard = true, className }: { target: number; standard: number | null | undefined; showStandard?: boolean; className?: string }) {
  if (standard == null || !(standard > 0)) {
    return (
      <span className={cx('inline-flex flex-wrap items-center gap-1.5', className)} title="Custom task without a project standard time" data-difficulty="none">
        <Chip tone="grey"><Gauge size={11} /> No standard</Chip>
      </span>
    );
  }
  const d = difficulty(target, standard);
  return (
    <span
      className={cx('inline-flex flex-wrap items-center gap-1.5', className)}
      title={`Target ${fmtMin(Math.max(0, Math.round(target)) || 0)} vs standard ${fmtMin(standard)}. Within 10% of the standard counts as standard.`}
      data-difficulty={d.level}
    >
      <Chip tone={DIFFICULTY_TONE[d.level]}><Gauge size={11} /> {difficultyLabel(d)}</Chip>
      {showStandard && <span className="text-xs text-muted">standard {fmtMin(standard)}</span>}
    </span>
  );
}
/** Difficulty badge for an assigned task (target vs the standard stored at assign time). */
export function TaskDifficulty({ task, showStandard = true }: { task: Task; showStandard?: boolean }) {
  return <DifficultyBadge target={task.targetMinutes} standard={taskStandard(task)} showStandard={showStandard} />;
}

/** "Resubmitted 2x" once a task was sent again after feedback. */
export function ResubmitChip({ task }: { task: Pick<Task, 'resubmits'> }) {
  const n = task.resubmits ?? 0;
  if (n < 1) return null;
  return <span data-testid="resubmits"><Chip tone="peach"><Repeat size={11} /> Resubmitted {n}x</Chip></span>;
}

// ---------------------------------------------------------------------------------------------
// History timeline
// ---------------------------------------------------------------------------------------------

const EVENT: Record<TaskAction, { title: string; tone: string; icon: typeof Send }> = {
  assigned: { title: 'Assigned', tone: 'grey', icon: UserPlus },
  submitted: { title: 'Sent for approval', tone: 'lavender', icon: Send },
  resubmitted: { title: 'Resubmitted for approval', tone: 'peach', icon: Repeat },
  feedback: { title: 'Feedback', tone: 'butter', icon: MessageSquare },
  forwarded: { title: 'Forwarded', tone: 'sky', icon: Forward },
  approved: { title: 'Approved', tone: 'mint', icon: CheckCheck },
  edited: { title: 'Edited', tone: 'grey', icon: Pencil },
  reminded: { title: 'Reminder sent', tone: 'grey', icon: BellRing },
};
const DOT: Record<string, string> = {
  grey: 'bg-grey text-grey-ink', lavender: 'bg-lavender text-lavender-ink', peach: 'bg-peach text-peach-ink', butter: 'bg-butter text-butter-ink',
  sky: 'bg-sky text-sky-ink', mint: 'bg-mint text-mint-ink',
};

/** Who did what, in words: "by Bheeshma to Udhaya", "to Bheeshma", "from Bheeshma". */
function eventDetail(e: TaskEvent): string {
  if (e.action === 'feedback') return `from ${first(e.by)}`;
  const to = e.to && e.action !== 'approved' && e.action !== 'edited' ? ` to ${first(e.to)}` : '';
  return `by ${first(e.by)}${to}`;
}
const events = (t: Task): TaskEvent[] => [...(t.history ?? [])].sort((a, b) => a.at.localeCompare(b.at));

/** One-line summary of where a task is: "Approved 12:05, 3h 10m after it was assigned". */
function historySummary(t: Task): string {
  const ev = events(t);
  const assigned = ev.find((e) => e.action === 'assigned');
  const rounds = ev.filter((e) => e.action === 'feedback').length;
  const parts: string[] = [];
  if (t.approvedAt && assigned) parts.push(`Assigned to approved in ${span(assigned.at, t.approvedAt)}`);
  else if (t.status === 'in_review' && t.submittedAt) parts.push(`Waiting for approval since ${shortStamp(t.submittedAt)}`);
  if (rounds) parts.push(`${rounds} feedback round${rounds === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** "History (4)" button that opens the timeline. Pair it with <HistoryTimeline>. */
export function HistoryToggle({ task, open, onClick, className }: { task: Task; open: boolean; onClick: () => void; className?: string }) {
  const ev = events(task);
  const last = ev[ev.length - 1];
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={cx('focus-ring inline-flex items-center gap-1 rounded-md text-xs font-semibold text-accent-ink hover:underline', className)}
    >
      <History size={12} /> History ({ev.length})
      <ChevronDown size={12} className={cx('transition-transform', open && 'rotate-180')} />
      {!open && last && <span className="font-normal text-muted">· last: {EVENT[last.action]?.title.toLowerCase() ?? last.action} {shortStamp(last.at)}</span>}
    </button>
  );
}

/** The full timeline with exact times: assigned, sent for approval, feedback (by whom), resubmitted, forwarded, approved. */
export function HistoryTimeline({ task, className }: { task: Task; className?: string }) {
  const ev = events(task);
  const summary = historySummary(task);
  if (!ev.length) return <p className={cx('text-xs text-muted', className)}>No history recorded for this task yet.</p>;
  let resubmitN = 0;
  return (
    <div className={cx('rounded-xl border border-line bg-surface-2/60 px-3 py-2.5', className)} data-testid="task-history">
      <ol className="space-y-2">
        {ev.map((e, i) => {
          const meta = EVENT[e.action] ?? { title: e.action, tone: 'grey', icon: History };
          const Icon = meta.icon;
          if (e.action === 'resubmitted') resubmitN++;
          return (
            <li key={`${e.at}-${i}`} className="relative flex gap-3 text-sm" data-action={e.action}>
              {i < ev.length - 1 && <span aria-hidden className="absolute left-[11px] top-6 h-[calc(100%-0.5rem)] w-px bg-line" />}
              <span className={cx('relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', DOT[meta.tone])}><Icon size={12} /></span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span>
                    <b>{meta.title}</b> <span className="text-muted">{eventDetail(e)}</span>
                    {e.action === 'resubmitted' && <span className="text-muted"> · resubmit {resubmitN}</span>}
                  </span>
                  <time dateTime={e.at} className="text-xs tabular-nums text-muted">{fmtStamp(e.at)}</time>
                </p>
                {e.note && <p className="mt-0.5 text-xs text-muted">{e.action === 'edited' ? `Changed ${e.note}` : `"${e.note}"`}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {summary && <p className="mt-2 border-t border-line pt-2 text-xs text-muted">{summary}</p>}
    </div>
  );
}

/** Self-contained toggle + timeline (for logs and lists). */
export function TaskHistory({ task, defaultOpen = false, className }: { task: Task; defaultOpen?: boolean; className?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <HistoryToggle task={task} open={open} onClick={() => setOpen((v) => !v)} />
      {open && <HistoryTimeline task={task} className="mt-2" />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------

/** Everyone in the company except the viewer, project manager first. */
function useReviewerOptions(projectId: string) {
  const { me, projects } = useStore();
  const pm = projects.find((p) => p.id === projectId)?.pmId;
  return PEOPLE.filter((p) => p.id !== me).sort((a, b) => Number(b.id === pm) - Number(a.id === pm) || nameOf(a.id).localeCompare(nameOf(b.id))).map((p) => ({
    id: p.id,
    label: `${nameOf(p.id)} · ${p.id === pm ? 'Project manager of this project' : p.title}`,
  }));
}

/** Compact row for a task the viewer owns. */
export function TaskRow({ task }: { task: Task }) {
  const { submitForReview } = useStore();
  const options = useReviewerOptions(task.projectId);
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [qty, setQty] = useState(task.doneQty ?? task.qty);
  const [mins, setMins] = useState(task.minutes ?? task.targetMinutes);
  const [reviewer, setReviewer] = useState(task.reviewerId ?? options[0]?.id ?? '');
  const [err, setErr] = useState('');
  const type = TASK_TYPES.find((t) => t.id === task.typeId);
  const st = STATUS[task.status];
  const carried = task.date < day(0) && task.status !== 'done';
  const lastFb = task.feedback.filter((f) => !f.text.startsWith('Forwarded:')).pop();
  const canSubmit = task.status === 'todo' || task.status === 'in_progress' || task.status === 'changes';
  const std = taskStandard(task);
  const resubmitting = task.status === 'changes' || (task.history ?? []).some((e) => e.action === 'feedback');

  return (
    <li className="px-4 py-3" data-task={task.id}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-[200px] flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold first-letter:uppercase">
            {task.title}
            {task.priority && <Chip tone="coral"><Star size={11} /> Priority · {first(task.assignedById)}</Chip>}
            {carried && <Chip tone="butter"><History size={11} /> {task.date === day(-1) ? 'From yesterday' : `Carried over from ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(`${task.date}T12:00:00`).getDay()]} ${fmtDay(task.date)}`}</Chip>}
            {task.reminders > 0 && task.status !== 'done' && <Chip tone="peach">⏰ Reminded</Chip>}
            <ResubmitChip task={task} />
          </p>
          <p className="text-xs text-muted">
            Target {fmtMin(task.targetMinutes)}{std != null && std !== task.targetMinutes ? ` (standard ${fmtMin(std)})` : ''}{type ? ` · ideal ${type.ideal}` : ' · custom task'}
          </p>
          <HistoryToggle task={task} open={showHistory} onClick={() => setShowHistory((v) => !v)} className="mt-0.5" />
        </div>
        <PaceChip task={task} />
        <Chip tone={st.tone}>{st.label}</Chip>
        {canSubmit && <Btn onClick={() => { setErr(''); setOpen(true); }}><Send size={13} /> {task.status === 'changes' ? 'Resubmit' : 'Submit'}</Btn>}
        {task.status === 'in_review' && <span className="text-xs text-muted">with {first(task.reviewerId)} since {shortStamp(task.submittedAt)}</span>}
        {task.status === 'done' && task.approvedAt && <span className="text-xs text-muted">approved {shortStamp(task.approvedAt)}</span>}
      </div>
      {task.status === 'changes' && lastFb && (
        <p className="mt-2 rounded-lg border-l-4 border-butter-strong bg-butter/50 px-3 py-2 text-sm"><b>{first(lastFb.by)}</b> <span className="text-xs text-muted">{shortStamp(lastFb.at)}</span>: {lastFb.text}</p>
      )}
      {showHistory && <HistoryTimeline task={task} className="mt-2" />}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={resubmitting ? 'Resubmit for approval' : 'Submit for approval'}
        description={task.title}
        size="sm"
        footer={
          <Btn onClick={() => {
            if (safe(() => submitForReview(task.id, qty, mins, reviewer), setErr)) {
              setOpen(false);
              toast({ title: `${resubmitting ? 'Resubmitted' : 'Sent'} to ${first(reviewer)} for approval`, tone: 'success' });
            }
          }}>
            <Send size={14} /> Send to {first(reviewer)}
          </Btn>
        }
      >
        <label className="text-sm font-semibold">
          Who should review it?
          <select className={cx(input, 'mt-1')} value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">
            {task.unit[0].toUpperCase() + task.unit.slice(1)} done
            <input type="number" min={1} className={cx(input, 'mt-1')} value={qty} onChange={(e) => setQty(+e.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Minutes taken
            <input type="number" min={1} className={cx(input, 'mt-1')} value={mins} onChange={(e) => setMins(+e.target.value)} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[15, 30, 45, 60, 90, 120].map((m) => (
            <Btn key={m} type="button" tone={m === mins ? 'primary' : 'ghost'} className="border border-line" onClick={() => setMins(m)}>{fmtMin(m)}</Btn>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">Target: {fmtMin(task.targetMinutes)} for {task.qty} {task.unit}</p>
        {resubmitting && <p className="mt-1 text-xs text-muted">This will be resubmit {(task.resubmits ?? 0) + 1}. The time you send it is recorded in the task history.</p>}
        {err && <p role="alert" className="mt-2 text-sm font-semibold text-coral-ink">{err}</p>}
      </Modal>
    </li>
  );
}

/** One line in a reviewer's queue: see the history, then approve, give feedback, or forward to someone else. */
export function ReviewRow({ task, projectName }: { task: Task; projectName: string }) {
  const { approve, sendBack, forwardReview } = useStore();
  const options = useReviewerOptions(task.projectId).filter((o) => o.id !== task.assigneeId);
  const [mode, setMode] = useState<null | 'feedback' | 'forward'>(null);
  const [fb, setFb] = useState('');
  const [to, setTo] = useState(options[0]?.id ?? '');
  const ev = events(task);
  const forwarded = [...ev].reverse().find((e) => e.action === 'forwarded');
  // Reviewers should see the back-and-forth before approving: open it straight away for resubmitted or forwarded tasks.
  const [showHistory, setShowHistory] = useState((task.resubmits ?? 0) > 0 || !!forwarded);
  const firstSent = ev.find((e) => e.action === 'submitted');
  return (
    <li className="px-4 py-3" data-review={task.id}>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar id={task.assigneeId} size="sm" />
        <div className="min-w-[200px] flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold first-letter:uppercase">
            {task.title} {task.priority && <Chip tone="coral"><Star size={11} /> Priority</Chip>}
            <ResubmitChip task={task} />
            {forwarded && <Chip tone="sky"><Forward size={11} /> Forwarded by {first(forwarded.by)}</Chip>}
          </p>
          <p className="text-xs text-muted">{first(task.assigneeId)} · {projectName} · {task.doneQty} {task.unit} in {fmtMin(task.minutes ?? 0)} (target {fmtMin(task.targetMinutes)})</p>
          <p className="text-xs text-muted">
            Sent for approval {fmtStamp(task.submittedAt)}
            {(task.resubmits ?? 0) > 0 && firstSent && firstSent.at !== task.submittedAt ? ` · first sent ${shortStamp(firstSent.at)}` : ''}
          </p>
          <HistoryToggle task={task} open={showHistory} onClick={() => setShowHistory((v) => !v)} className="mt-0.5" />
        </div>
        <PaceChip task={task} />
        <Btn onClick={() => safe(() => { approve(task.id); toast({ title: `Approved, ${first(task.assigneeId)} notified`, tone: 'success' }); })}><Check size={13} /> Approve</Btn>
        <Btn tone="ghost" className="border border-line" onClick={() => setMode(mode === 'feedback' ? null : 'feedback')}><MessageSquare size={13} /> Feedback</Btn>
        <Btn tone="ghost" className="border border-line" onClick={() => setMode(mode === 'forward' ? null : 'forward')}><Forward size={13} /> Forward</Btn>
      </div>
      {showHistory && <HistoryTimeline task={task} className="mt-2 sm:ml-10" />}
      {mode === 'feedback' && (
        <form className="mt-2 sm:ml-10 flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (safe(() => sendBack(task.id, fb))) { toast({ title: `Feedback sent to ${first(task.assigneeId)}`, tone: 'info' }); setFb(''); setMode(null); }
        }}>
          <input className={input} autoFocus placeholder="What should they change?" value={fb} onChange={(e) => setFb(e.target.value)} />
          <Btn type="submit">Send</Btn>
        </form>
      )}
      {mode === 'forward' && (
        <form className="mt-2 sm:ml-10 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => {
          e.preventDefault();
          if (safe(() => forwardReview(task.id, to, fb))) { toast({ title: `Forwarded to ${first(to)}`, tone: 'info' }); setFb(''); setMode(null); }
        }}>
          <select aria-label="Forward to" className={input} value={to} onChange={(e) => setTo(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <input className={input} placeholder="Note (optional)" value={fb} onChange={(e) => setFb(e.target.value)} />
          <Btn type="submit"><Forward size={13} /> Forward</Btn>
        </form>
      )}
    </li>
  );
}
