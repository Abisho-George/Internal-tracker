import { useId, useMemo, useState, type FormEvent } from 'react';
import { CheckCheck, Timer } from 'lucide-react';
import { clockNow, formatMinutes, useApp } from '@/store';
import type { Task, TaskType } from '@/store/types';
import { Button, Field, Modal, NumberStepper, PillToggle, TextInput, toast } from '@/components';
import { completionToast, doneLabel, parseDuration, roundToFive, toHhMm } from './components/helpers';

const QUICK_CHIPS: { minutes: number; label: string }[] = [
  { minutes: 15, label: '15m' },
  { minutes: 30, label: '30m' },
  { minutes: 45, label: '45m' },
  { minutes: 60, label: '1h' },
  { minutes: 90, label: '1h 30m' },
  { minutes: 120, label: '2h' },
];

export interface MarkDoneModalProps {
  task?: Task;
  taskType?: TaskType;
  open: boolean;
  onClose: () => void;
  /** Called after the task was completed (the page pops the rating chip in). */
  onCompleted?: (taskId: string) => void;
}

/** Where the time prefill comes from. */
type Prefill = { minutes: number; source: 'timer' | 'previous' } | null;

function initialPrefill(task: Task | undefined): Prefill {
  if (!task) return null;
  // "Mark done again" after a review note: keep the time already logged.
  if (task.status === 'done' && task.actualMinutes != null) return { minutes: task.actualMinutes, source: 'previous' };
  if (task.startedAt) {
    const now = clockNow(useApp.getState().clock).getTime();
    const elapsed = (now - Date.parse(task.startedAt)) / 60_000;
    return { minutes: roundToFive(elapsed), source: 'timer' };
  }
  return null;
}

/**
 * "Mark done" dialog: time taken (quick chips or a custom h:mm), quantity done and
 * an optional one-line note. Mount it with a fresh `key` per opening so the
 * fields start from the task (and the running timer) every time.
 */
export function MarkDoneModal({ task, taskType, open, onClose, onCompleted }: MarkDoneModalProps) {
  const completeTask = useApp((s) => s.completeTask);
  const formId = useId();
  const timeHintId = useId();

  const [prefill] = useState<Prefill>(() => initialPrefill(task));
  const [minutes, setMinutes] = useState<number | null>(prefill?.minutes ?? null);
  const [timeText, setTimeText] = useState(prefill ? toHhMm(prefill.minutes) : '');
  const [quantity, setQuantity] = useState(task ? (task.quantityDone ?? task.quantity) : 0);
  const [note, setNote] = useState(task?.note ?? '');
  const [touchedTime, setTouchedTime] = useState(false);

  // Frozen at mount: once submitted the task is "done", and the closing dialog
  // must not flip its title to "Mark done again" during the exit animation.
  const [again] = useState(() => task?.status === 'done');
  const [base] = useState(() => (task ? (task.quantityDone ?? task.quantity) : 0));
  const standard = useMemo(() => {
    if (!task) return 0;
    // A PM's "adjusted for today" standard wins as is (same as rating.effectiveStandard).
    if (task.dayAdjustment) return task.dayAdjustment.newStandardMinutes;
    // Otherwise the store scales the standard when the quantity done differs from the plan.
    const std = task.standardMinutes;
    return quantity > 0 && base > 0 && quantity !== base ? Math.max(1, Math.round((std * quantity) / base)) : std;
  }, [task, quantity, base]);

  const invalidTime = touchedTime && timeText.trim() !== '' && minutes == null;
  const canSubmit = !!task && minutes != null && minutes >= 1;

  const pickChip = (value: number) => {
    setMinutes(value);
    setTimeText(toHhMm(value));
    setTouchedTime(false);
  };

  const onTimeText = (text: string) => {
    setTimeText(text);
    setMinutes(parseDuration(text));
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!task || minutes == null) {
      setTouchedTime(true);
      return;
    }
    const input = { actualMinutes: minutes, quantityDone: quantity, note: note.trim() || undefined };
    const result = completeTask(task.id, input);
    const label = doneLabel({ ...task, quantityDone: quantity }, taskType);
    const copy = completionToast(result.rating, label, minutes, result.reviewerName);
    toast({ title: copy.title, description: copy.description, emoji: copy.emoji, tone: 'success', durationMs: 5000 });
    onCompleted?.(task.id);
    onClose();
  };

  const unit = taskType ? (quantity === 1 ? taskType.unitSingular : taskType.unit) : undefined;

  return (
    <Modal
      open={open && !!task}
      onClose={onClose}
      title={again ? 'Mark done again' : 'Mark done'}
      description={task?.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} icon={CheckCheck} disabled={!canSubmit}>
            {again ? 'Mark done again' : 'Mark done'}
          </Button>
        </>
      }
    >
      {task && (
        <form id={formId} onSubmit={submit} className="space-y-5" noValidate>
          <Field
            label="Time taken"
            hint={
              <span id={timeHintId} className="flex flex-col gap-0.5">
                {prefill?.source === 'timer' && (
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3 w-3 shrink-0" aria-hidden />
                    From your timer: {formatMinutes(prefill.minutes)} (rounded to the nearest 5 min)
                  </span>
                )}
                {prefill?.source === 'previous' && (
                  <span>You logged {formatMinutes(prefill.minutes)} before — add any tweak time if you like</span>
                )}
                <span>Standard for this task: {formatMinutes(standard)}</span>
              </span>
            }
          >
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick times">
              {QUICK_CHIPS.map((chip) => (
                <PillToggle
                  key={chip.minutes}
                  size="sm"
                  pressed={minutes === chip.minutes}
                  onChange={() => pickChip(chip.minutes)}
                  aria-label={`${chip.label} taken`}
                >
                  {chip.label}
                </PillToggle>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <label htmlFor={`${formId}-custom`} className="text-xs font-semibold text-muted">
                Custom (h:mm)
              </label>
              <TextInput
                id={`${formId}-custom`}
                value={timeText}
                onChange={(e) => onTimeText(e.target.value)}
                onBlur={() => setTouchedTime(true)}
                placeholder="1:20"
                inputMode="numeric"
                autoComplete="off"
                invalid={invalidTime}
                aria-describedby={timeHintId}
                className="w-28 tabular-nums"
              />
              {minutes != null && (
                <span className="text-sm font-semibold text-ink" aria-live="polite">
                  = {formatMinutes(minutes)}
                </span>
              )}
            </div>
            {invalidTime && (
              <p className="text-xs font-medium text-butter-ink" role="status">
                Try a time like 1:20, 45 or 2h — up to 16 hours.
              </p>
            )}
          </Field>

          <Field label="Quantity done">
            <div className="flex items-center gap-3">
              <NumberStepper
                value={quantity}
                onChange={setQuantity}
                min={1}
                max={Math.max(task.quantity * 5, 10)}
                ariaLabel="Quantity done"
              />
              {unit && <span className="text-sm text-muted">{unit}</span>}
              {quantity !== task.quantity && (
                <span className="text-xs text-muted">
                  Planned {task.quantity}
                  {task.dayAdjustment ? '' : ' · standard adjusts to match'}
                </span>
              )}
            </div>
          </Field>

          <Field label="Note" optional hint="One line is plenty — your PM sees it with the task.">
            <TextInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              placeholder="e.g. Two contacts swapped for fresher ones"
              autoComplete="off"
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}

export default MarkDoneModal;
