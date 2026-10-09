import { useState } from 'react';
import { Check, History, MessageSquare, Play, Send, Star } from 'lucide-react';
import { Modal, toast } from '@/components';
import { day, TASK_TYPES, stdMinutes, type Task } from '../data';
import { first, useStore } from '../store';
import { Avatar, Btn, Chip, STATUS, cx, fmtMin, input, safe } from '../ui';

const effOf = (t: Task) => (t.minutes && t.doneQty ? Math.round((stdMinutes(t, t.doneQty) / t.minutes) * 100) : null);

/** Compact row for a task the viewer owns: status, target time and the next action. */
export function TaskRow({ task }: { task: Task }) {
  const { startTask, submitForReview } = useStore();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(task.doneQty ?? task.qty);
  const [mins, setMins] = useState(task.minutes ?? stdMinutes(task, task.qty));
  const [err, setErr] = useState('');
  const type = TASK_TYPES.find((t) => t.id === task.typeId);
  if (!type) return null;
  const st = STATUS[task.status];
  const carried = task.date < day(0) && task.status !== 'done';
  const lastFb = task.feedback[task.feedback.length - 1];
  const canSubmit = task.status === 'todo' || task.status === 'in_progress' || task.status === 'changes';

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', task.status === 'done' ? 'bg-mint-strong' : task.status === 'in_review' ? 'bg-lavender-strong' : task.status === 'changes' ? 'bg-butter-strong' : task.status === 'in_progress' ? 'bg-sky-strong' : 'bg-grey-strong')} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold capitalize">
            {task.title}
            {task.priority && <Chip tone="coral"><Star size={11} /> Priority · {first(task.assignedById)}</Chip>}
            {carried && <Chip tone="butter"><History size={11} /> From yesterday</Chip>}
          </p>
          <p className="text-xs text-muted">Target {fmtMin(stdMinutes(task, task.qty))} · ideal {type.ideal}</p>
        </div>
        <Chip tone={st.tone}>{st.label}</Chip>
        {task.status === 'todo' && <Btn tone="ghost" className="border border-line" onClick={() => startTask(task.id)}><Play size={13} /> Start</Btn>}
        {canSubmit && <Btn onClick={() => { setErr(''); setOpen(true); }}><Send size={13} /> {task.status === 'changes' ? 'Resubmit' : 'Submit'}</Btn>}
        {task.status === 'in_review' && <span className="text-xs text-muted">with {first(task.reviewerId)}</span>}
      </div>
      {task.status === 'changes' && lastFb && (
        <p className="ml-5 mt-2 rounded-lg border-l-4 border-butter-strong bg-butter/50 px-3 py-2 text-sm"><b>{first(lastFb.by)}:</b> {lastFb.text}</p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Submit for review"
        description={`${first(task.reviewerId)} gets notified instantly.`}
        size="sm"
        footer={
          <Btn
            onClick={() => {
              if (safe(() => submitForReview(task.id, qty, mins), setErr)) {
                setOpen(false);
                toast({ title: `Sent to ${first(task.reviewerId)} for review`, tone: 'success' });
              }
            }}
          >
            <Send size={14} /> Submit
          </Btn>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">
            {type.unit[0].toUpperCase() + type.unit.slice(1)} done
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
        {qty > 0 && <p className="mt-3 text-sm text-muted">Target for {qty} {type.unit}: {fmtMin(stdMinutes(task, qty))}</p>}
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
  const type = TASK_TYPES.find((t) => t.id === task.typeId);
  const eff = effOf(task);
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar id={task.assigneeId} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold capitalize">
            {task.title} {task.priority && <Chip tone="coral"><Star size={11} /> Priority</Chip>}
          </p>
          <p className="text-xs text-muted">{first(task.assigneeId)} · {projectName} · {task.doneQty} {type?.unit} in {fmtMin(task.minutes ?? 0)}</p>
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
