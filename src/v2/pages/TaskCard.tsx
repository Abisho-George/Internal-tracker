import { useState } from 'react';
import { Check, MessageSquare, Play, Send, Star } from 'lucide-react';
import { Modal, toast } from '@/components';
import { PROJECTS, TASK_TYPES, stdMinutes, type Task } from '../data';
import { first, useStore } from '../store';
import { Avatar, Btn, Chip, STATUS, cx, fmtMin, input } from '../ui';

/** A task as seen by its assignee (mode "mine") or its reviewer (mode "review"). */
export function TaskCard({ task, mode }: { task: Task; mode: 'mine' | 'review' | 'view' }) {
  const { startTask, submitForReview, approve, sendBack } = useStore();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [qty, setQty] = useState(task.doneQty ?? task.qty);
  const [mins, setMins] = useState(task.minutes ?? stdMinutes(task, task.qty));
  const [fb, setFb] = useState('');
  const [fbOpen, setFbOpen] = useState(false);
  const type = TASK_TYPES.find((t) => t.id === task.typeId)!;
  const project = PROJECTS.find((p) => p.id === task.projectId);
  const std = stdMinutes(task, task.qty);
  const st = STATUS[task.status];
  const eff = task.minutes && task.doneQty ? Math.round((stdMinutes(task, task.doneQty) / task.minutes) * 100) : null;
  const lastFb = task.feedback[task.feedback.length - 1];

  return (
    <div className={cx('rounded-2xl border border-line bg-surface p-4', task.priority && 'ring-2 ring-peach-strong/60')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {task.priority && <Chip tone="peach"><Star size={12} /> Priority</Chip>}
            <p className="font-semibold capitalize">{task.title}</p>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {project?.name} · ideal {type.ideal} · target {fmtMin(std)}
            {mode !== 'mine' && <> · by {first(task.assigneeId)}</>}
          </p>
        </div>
        <Chip tone={st.tone}>{st.label}</Chip>
      </div>

      {(task.status === 'in_review' || task.status === 'done' || task.status === 'changes') && task.minutes != null && (
        <p className="mt-2 text-sm text-muted">
          {task.doneQty} {type.unit} in {fmtMin(task.minutes)}
          {eff != null && <span className={cx('ml-2 font-semibold', eff >= 100 ? 'text-mint-ink' : 'text-butter-ink')}>{eff}% efficiency</span>}
        </p>
      )}

      {task.status === 'changes' && lastFb && (
        <div className="mt-3 flex gap-2 rounded-xl bg-butter/60 p-3 text-sm">
          <Avatar id={lastFb.by} size="sm" />
          <p><b>{first(lastFb.by)}:</b> {lastFb.text}</p>
        </div>
      )}
      {task.status === 'in_review' && mode === 'mine' && (
        <p className="mt-2 text-xs text-lavender-ink">Waiting for {first(task.reviewerId)} to review</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {mode === 'mine' && task.status === 'todo' && (
          <Btn tone="soft" onClick={() => startTask(task.id)}><Play size={14} /> Start</Btn>
        )}
        {mode === 'mine' && (task.status === 'todo' || task.status === 'in_progress' || task.status === 'changes') && (
          <Btn onClick={() => setSubmitOpen(true)}><Send size={14} /> {task.status === 'changes' ? 'Resubmit for review' : 'Submit for review'}</Btn>
        )}
        {mode === 'review' && task.status === 'in_review' && (
          <>
            <Btn onClick={() => { approve(task.id); toast({ title: `Approved — ${first(task.assigneeId)} notified`, tone: 'success' }); }}>
              <Check size={14} /> Approve
            </Btn>
            <Btn tone="soft" onClick={() => setFbOpen((v) => !v)}><MessageSquare size={14} /> Give feedback</Btn>
          </>
        )}
      </div>

      {fbOpen && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!fb.trim()) return;
            sendBack(task.id, fb.trim());
            toast({ title: `Feedback sent to ${first(task.assigneeId)}`, tone: 'info' });
            setFb('');
            setFbOpen(false);
          }}
        >
          <input className={input} autoFocus placeholder="What should they change?" value={fb} onChange={(e) => setFb(e.target.value)} />
          <Btn type="submit">Send</Btn>
        </form>
      )}

      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Submit for review"
        description={`${first(task.reviewerId)} will be notified instantly.`}
        size="sm"
        footer={
          <Btn
            onClick={() => {
              submitForReview(task.id, qty, mins);
              setSubmitOpen(false);
              toast({ title: `Sent to ${first(task.reviewerId)} for review`, tone: 'success' });
            }}
          >
            <Send size={14} /> Submit
          </Btn>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">
            {type.unit[0].toUpperCase() + type.unit.slice(1)} done
            <input type="number" min={0} className={cx(input, 'mt-1')} value={qty} onChange={(e) => setQty(+e.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Minutes taken
            <input type="number" min={1} className={cx(input, 'mt-1')} value={mins} onChange={(e) => setMins(Math.max(1, +e.target.value))} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {[15, 30, 45, 60, 90, 120].map((m) => (
            <Btn key={m} type="button" tone={m === mins ? 'primary' : 'ghost'} className="border border-line" onClick={() => setMins(m)}>{fmtMin(m)}</Btn>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">Target for {qty} {type.unit}: {fmtMin(stdMinutes(task, qty))}</p>
      </Modal>
    </div>
  );
}
