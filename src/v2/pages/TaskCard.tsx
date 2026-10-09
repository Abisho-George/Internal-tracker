import { useState } from 'react';
import { Check, History, MessageSquare, Play, Send, Star, Undo2 } from 'lucide-react';
import { Modal, toast } from '@/components';
import { day, isLeadRole, PEOPLE, TASK_TYPES, taskEfficiency, type Task } from '../data';
import { first, useStore } from '../store';
import { Avatar, Btn, Chip, STATUS, cx, fmtMin, input, safe } from '../ui';

/** Compact row for a task the viewer owns: status, target time and the next action. */
export function TaskRow({ task }: { task: Task }) {
  const { me, projects, startTask, undoStart, submitForReview } = useStore();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(task.doneQty ?? task.qty);
  const [mins, setMins] = useState(task.minutes ?? task.targetMinutes);
  const project = projects.find((p) => p.id === task.projectId);
  // Reviewer options: the project's PM, plus managers and founders (never yourself).
  const reviewers = PEOPLE.filter((p) => p.id !== me && (p.id === project?.pmId || isLeadRole(p.role)));
  const [reviewer, setReviewer] = useState(task.reviewerId && task.reviewerId !== me ? task.reviewerId : reviewers[0]?.id ?? '');
  const [err, setErr] = useState('');
  const type = TASK_TYPES.find((t) => t.id === task.typeId);
  const st = STATUS[task.status];
  const carried = task.date < day(0) && task.status !== 'done';
  const lastFb = task.feedback[task.feedback.length - 1];
  const canSubmit = task.status === 'todo' || task.status === 'in_progress' || task.status === 'changes';
  const eff = taskEfficiency(task);

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
          <p className="text-xs text-muted">
            Target {fmtMin(task.targetMinutes)}{type ? ` · ideal ${type.ideal}` : ' · custom task'}
            {eff != null && ` · ${eff}% efficiency`}
          </p>
        </div>
        <Chip tone={st.tone}>{st.label}</Chip>
        {task.status === 'todo' && <Btn tone="ghost" className="border border-line" onClick={() => startTask(task.id)}><Play size={13} /> Start</Btn>}
        {task.status === 'in_progress' && (
          <Btn tone="ghost" className="border border-line" title="Started by mistake? Move it back to To do" onClick={() => { undoStart(task.id); toast({ title: 'Moved back to To do', tone: 'info' }); }}>
            <Undo2 size={13} /> Undo start
          </Btn>
        )}
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
          <Btn
            onClick={() => {
              if (safe(() => submitForReview(task.id, qty, mins, reviewer), setErr)) {
                setOpen(false);
                toast({ title: `Sent to ${first(reviewer)} for review`, tone: 'success' });
              }
            }}
          >
            <Send size={14} /> Send to {first(reviewer)}
          </Btn>
        }
      >
        <p className="mb-2 text-sm font-semibold">Who should review it?</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {reviewers.map((p) => (
            <button
              key={p.id}
              onClick={() => setReviewer(p.id)}
              className={cx('focus-ring flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm', p.id === reviewer ? 'border-accent bg-accent-soft font-semibold' : 'border-line')}
            >
              <Avatar id={p.id} size="sm" /> {first(p.id)} <span className="text-xs text-muted">{p.id === project?.pmId ? 'Project manager' : p.title}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
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

/** One line in a reviewer's queue with inline approve / feedback. */
export function ReviewRow({ task, projectName }: { task: Task; projectName: string }) {
  const { approve, sendBack } = useStore();
  const [fbOpen, setFbOpen] = useState(false);
  const [fb, setFb] = useState('');
  const eff = taskEfficiency(task);
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar id={task.assigneeId} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold first-letter:uppercase">
            {task.title} {task.priority && <Chip tone="coral"><Star size={11} /> Priority</Chip>}
          </p>
          <p className="text-xs text-muted">{first(task.assigneeId)} · {projectName} · {task.doneQty} {task.unit} in {fmtMin(task.minutes ?? 0)}</p>
        </div>
        {eff != null && <Chip tone={eff >= 100 ? 'mint' : 'butter'}>{eff}%</Chip>}
        <Btn onClick={() => safe(() => { approve(task.id); toast({ title: `Approved — ${first(task.assigneeId)} notified`, tone: 'success' }); })}><Check size={13} /> Approve</Btn>
        <Btn tone="ghost" className="border border-line" onClick={() => setFbOpen((v) => !v)}><MessageSquare size={13} /> Feedback</Btn>
      </div>
      {fbOpen && (
        <form
          className="ml-10 mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (safe(() => sendBack(task.id, fb))) {
              toast({ title: `Feedback sent to ${first(task.assigneeId)}`, tone: 'info' });
              setFb('');
              setFbOpen(false);
            }
          }}
        >
          <input className={input} autoFocus placeholder="What should they change?" value={fb} onChange={(e) => setFb(e.target.value)} />
          <Btn type="submit">Send</Btn>
        </form>
      )}
    </li>
  );
}
