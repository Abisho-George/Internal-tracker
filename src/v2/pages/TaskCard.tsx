import { useState } from 'react';
import { Check, Forward, History, MessageSquare, Send, Star } from 'lucide-react';
import { Modal, toast } from '@/components';
import { day, PEOPLE, TASK_TYPES, type Task } from '../data';
import { first, nameOf, paceMinutes, useStore } from '../store';
import { Avatar, Btn, Chip, STATUS, cx, fmtMin, input, safe } from '../ui';

/** "5m faster than target" / "12m over target" — plain words instead of a ratio. */
export function PaceChip({ task }: { task: Task }) {
  const d = paceMinutes(task);
  if (d == null) return null;
  if (d >= 0) return <Chip tone="mint">✓ On time{d > 0 ? ` · ${fmtMin(d)} faster` : ''}</Chip>;
  return <Chip tone="butter">{fmtMin(-d)} over target</Chip>;
}

/** Everyone in the company except the viewer, project manager first. */
function useReviewerOptions(projectId: string) {
  const { me, projects } = useStore();
  const pm = projects.find((p) => p.id === projectId)?.pmId;
  return PEOPLE.filter((p) => p.id !== me).sort((a, b) => Number(b.id === pm) - Number(a.id === pm) || nameOf(a.id).localeCompare(nameOf(b.id))).map((p) => ({
    id: p.id,
    label: `${nameOf(p.id)} — ${p.id === pm ? 'Project manager of this project' : p.title}`,
  }));
}

/** Compact row for a task the viewer owns. */
export function TaskRow({ task }: { task: Task }) {
  const { submitForReview } = useStore();
  const options = useReviewerOptions(task.projectId);
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(task.doneQty ?? task.qty);
  const [mins, setMins] = useState(task.minutes ?? task.targetMinutes);
  const [reviewer, setReviewer] = useState(task.reviewerId ?? options[0]?.id ?? '');
  const [err, setErr] = useState('');
  const type = TASK_TYPES.find((t) => t.id === task.typeId);
  const st = STATUS[task.status];
  const carried = task.date < day(0) && task.status !== 'done';
  const lastFb = task.feedback[task.feedback.length - 1];
  const canSubmit = task.status === 'todo' || task.status === 'in_progress' || task.status === 'changes';

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold first-letter:uppercase">
            {task.title}
            {task.priority && <Chip tone="coral"><Star size={11} /> Priority · {first(task.assignedById)}</Chip>}
            {carried && <Chip tone="butter"><History size={11} /> From yesterday</Chip>}
            {task.reminders > 0 && task.status !== 'done' && <Chip tone="peach">⏰ Reminded</Chip>}
          </p>
          <p className="text-xs text-muted">Target {fmtMin(task.targetMinutes)}{type ? ` · ideal ${type.ideal}` : ' · custom task'}</p>
        </div>
        <PaceChip task={task} />
        <Chip tone={st.tone}>{st.label}</Chip>
        {canSubmit && <Btn onClick={() => { setErr(''); setOpen(true); }}><Send size={13} /> {task.status === 'changes' ? 'Resubmit' : 'Submit'}</Btn>}
        {task.status === 'in_review' && <span className="text-xs text-muted">with {first(task.reviewerId)}</span>}
      </div>
      {task.status === 'changes' && lastFb && (
        <p className="mt-2 rounded-lg border-l-4 border-butter-strong bg-butter/50 px-3 py-2 text-sm"><b>{first(lastFb.by)}:</b> {lastFb.text}</p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Submit for review"
        description={task.title}
        size="sm"
        footer={
          <Btn onClick={() => {
            if (safe(() => submitForReview(task.id, qty, mins, reviewer), setErr)) {
              setOpen(false);
              toast({ title: `Sent to ${first(reviewer)} for review`, tone: 'success' });
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
        {err && <p role="alert" className="mt-2 text-sm font-semibold text-coral-ink">{err}</p>}
      </Modal>
    </li>
  );
}

/** One line in a reviewer's queue: approve, give feedback, or forward to someone else. */
export function ReviewRow({ task, projectName }: { task: Task; projectName: string }) {
  const { approve, sendBack, forwardReview } = useStore();
  const options = useReviewerOptions(task.projectId).filter((o) => o.id !== task.assigneeId);
  const [mode, setMode] = useState<null | 'feedback' | 'forward'>(null);
  const [fb, setFb] = useState('');
  const [to, setTo] = useState(options[0]?.id ?? '');
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar id={task.assigneeId} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold first-letter:uppercase">
            {task.title} {task.priority && <Chip tone="coral"><Star size={11} /> Priority</Chip>}
          </p>
          <p className="text-xs text-muted">{first(task.assigneeId)} · {projectName} · {task.doneQty} {task.unit} in {fmtMin(task.minutes ?? 0)} (target {fmtMin(task.targetMinutes)})</p>
        </div>
        <PaceChip task={task} />
        <Btn onClick={() => safe(() => { approve(task.id); toast({ title: `Approved — ${first(task.assigneeId)} notified`, tone: 'success' }); })}><Check size={13} /> Approve</Btn>
        <Btn tone="ghost" className="border border-line" onClick={() => setMode(mode === 'feedback' ? null : 'feedback')}><MessageSquare size={13} /> Feedback</Btn>
        <Btn tone="ghost" className="border border-line" onClick={() => setMode(mode === 'forward' ? null : 'forward')}><Forward size={13} /> Forward</Btn>
      </div>
      {mode === 'feedback' && (
        <form className="ml-10 mt-2 flex gap-2" onSubmit={(e) => {
          e.preventDefault();
          if (safe(() => sendBack(task.id, fb))) { toast({ title: `Feedback sent to ${first(task.assigneeId)}`, tone: 'info' }); setFb(''); setMode(null); }
        }}>
          <input className={input} autoFocus placeholder="What should they change?" value={fb} onChange={(e) => setFb(e.target.value)} />
          <Btn type="submit">Send</Btn>
        </form>
      )}
      {mode === 'forward' && (
        <form className="ml-10 mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => {
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
