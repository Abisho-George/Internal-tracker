import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Avatar, Button, Modal, NumberStepper, ProjectChip, RatingChip, cn, toast } from '@/components';
import {
  ADJUST_REASONS,
  formatMinutes,
  rateTask,
  useApp,
  usePerson,
  useSettings,
  useToday,
  type AdjustReason,
  type Task,
} from '@/store';
import { CoreChoicePills } from './components/core/CoreChoicePills';
import { RATING_GLYPH } from './components/core/coreUtils';

export interface AdjustStandardModalProps {
  /** The task to adjust (usually a "Can do better" one). */
  taskId: string | null | undefined;
  open: boolean;
  onClose: () => void;
  /** Called after a save or a removal (after `onClose`), e.g. to move focus to the updated task. */
  onSaved?: (taskId: string) => void;
}

const MAX_MINUTES = 16 * 60;

/** Prefill: the current adjustment if there is one, otherwise the actual time taken. */
function initialMinutes(task: Task): number {
  return task.dayAdjustment?.newStandardMinutes ?? task.actualMinutes ?? task.standardMinutes;
}

/**
 * "Adjust standard for today" (spec §8.2 F). Changes only this task's standard for
 * its day — the task library is untouched — and the rating recalculates live.
 */
export function AdjustStandardModal({ taskId, open, onClose, onSaved }: AdjustStandardModalProps) {
  const task = useApp((s) => (taskId ? s.tasks.find((t) => t.id === taskId) : undefined));
  const project = useApp((s) => (task ? s.projects.find((p) => p.id === task.projectId) : undefined));
  const person = usePerson(task?.assigneeId);
  const settings = useSettings();
  const today = useToday();
  const adjustStandard = useApp((s) => s.adjustStandard);
  const clearAdjustment = useApp((s) => s.clearAdjustment);
  const reduce = useReducedMotion();
  const reasonLabelId = useId();
  const minutesId = useId();

  const [minutes, setMinutes] = useState(0);
  const [reason, setReason] = useState<AdjustReason | null>(null);
  const [showReasonHint, setShowReasonHint] = useState(false);
  // Re-initialise the form each time the modal opens for a task.
  const sessionKey = open && task ? task.id : null;
  const [session, setSession] = useState<string | null>(null);
  if (sessionKey !== session) {
    setSession(sessionKey);
    if (sessionKey && task) {
      setMinutes(initialMinutes(task));
      setReason(task.dayAdjustment?.reason ?? null);
      setShowReasonHint(false);
    }
  }

  const isOpen = open && !!task;
  const dayWord = task && task.date !== today ? 'the day' : 'today';
  const currentRating = task ? rateTask(task, settings) : undefined;
  const previewRating =
    task && minutes > 0
      ? rateTask(
          { ...task, dayAdjustment: { newStandardMinutes: minutes, reason: reason ?? 'Other', byPmId: '', at: '' } },
          settings,
        )
      : undefined;

  const save = () => {
    if (!task) return;
    if (!reason) {
      setShowReasonHint(true);
      return;
    }
    adjustStandard(task.id, minutes, reason);
    const after = rateTask(
      { ...task, dayAdjustment: { newStandardMinutes: Math.max(1, Math.round(minutes)), reason, byPmId: '', at: '' } },
      settings,
    );
    toast({
      title: after ? `Adjusted for ${dayWord} — now ${after} ${RATING_GLYPH[after]}` : `Adjusted for ${dayWord}`,
      description: 'Only this task changes. The task library stays as it is.',
    });
    onClose();
    onSaved?.(task.id);
  };

  const remove = () => {
    if (!task) return;
    clearAdjustment(task.id);
    const back = rateTask({ ...task, dayAdjustment: undefined }, settings);
    toast({
      title: 'Adjustment removed',
      description: back ? `Back to the original standard — ${back} ${RATING_GLYPH[back]}` : 'Back to the original standard.',
      tone: 'info',
    });
    onClose();
    onSaved?.(task.id);
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Adjust standard for ${dayWord}`}
      description={`Only this task changes for ${dayWord} — the standard in the task library stays as it is.`}
      footer={
        <>
          {task?.dayAdjustment && (
            <Button variant="ghost" onClick={remove} className="mr-auto">
              Remove adjustment
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} aria-describedby={!reason ? `${reasonLabelId}-hint` : undefined}>
            Save adjustment
          </Button>
        </>
      }
    >
      {task && (
        <div className="space-y-5">
          {/* The task */}
          <div className="rounded-2xl bg-surface-2/70 p-4">
            <p className="font-semibold leading-snug text-ink">{task.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              {person && (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar person={person} size="xs" decorative />
                  {person.name}
                </span>
              )}
              {project && <ProjectChip project={project} short />}
            </div>
          </div>

          {/* Original vs actual vs current rating */}
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-line/70 px-2 py-3">
              <dt className="text-xs font-medium text-muted">Original standard</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{formatMinutes(task.standardMinutes)}</dd>
            </div>
            <div className="rounded-2xl border border-line/70 px-2 py-3">
              <dt className="text-xs font-medium text-muted">Actual time</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-ink">
                {task.actualMinutes != null ? formatMinutes(task.actualMinutes) : '—'}
              </dd>
            </div>
            <div className="rounded-2xl border border-line/70 px-2 py-3">
              <dt className="text-xs font-medium text-muted">Current rating</dt>
              <dd className="mt-1.5 flex justify-center">
                {currentRating ? <RatingChip rating={currentRating} size="sm" /> : <span className="text-sm text-muted">Up next</span>}
              </dd>
            </div>
          </dl>

          {/* New standard */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={minutesId} className="w-fit text-sm font-semibold text-ink">
              New standard for {dayWord}
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <NumberStepper
                id={minutesId}
                value={minutes}
                onChange={setMinutes}
                min={1}
                max={MAX_MINUTES}
                step={5}
                suffix="min"
                ariaLabel={`New standard for ${dayWord} in minutes`}
              />
              <span className="text-sm font-semibold tabular-nums text-ink" aria-live="polite">
                = {formatMinutes(minutes)}
              </span>
              {task.actualMinutes != null && minutes === task.actualMinutes && (
                <span className="text-xs text-muted">Prefilled with the actual time taken</span>
              )}
              {task.actualMinutes != null && minutes !== task.actualMinutes && (
                <button
                  type="button"
                  onClick={() => setMinutes(task.actualMinutes!)}
                  className="focus-ring rounded-lg px-1.5 py-0.5 text-xs font-semibold text-accent-ink underline-offset-2 hover:underline"
                >
                  Use actual time ({formatMinutes(task.actualMinutes)})
                </button>
              )}
            </div>
          </div>

          {/* Reason */}
          <div className="flex flex-col gap-2">
            <span id={reasonLabelId} className="text-sm font-semibold text-ink">
              Reason
            </span>
            <CoreChoicePills
              labelledBy={reasonLabelId}
              options={ADJUST_REASONS.map((r) => ({ value: r, label: r }))}
              value={reason}
              onChange={(r) => {
                setReason(r);
                setShowReasonHint(false);
              }}
            />
            <p
              id={`${reasonLabelId}-hint`}
              className={cn('text-xs', showReasonHint ? 'font-semibold text-butter-ink' : 'text-muted')}
              role={showReasonHint ? 'status' : undefined}
            >
              {showReasonHint ? 'Pick a reason first, so everyone knows why later.' : 'Pick one, so everyone knows why later.'}
            </p>
          </div>

          {/* Live preview */}
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent-soft/60 px-4 py-3" aria-live="polite">
            <span className="text-sm font-semibold text-ink">New rating</span>
            {currentRating && <RatingChip rating={currentRating} size="sm" />}
            <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
            <span className="sr-only">becomes</span>
            <AnimatePresence mode="popLayout" initial={false}>
              {previewRating ? (
                <motion.span
                  key={previewRating}
                  initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={reduce ? undefined : { scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="inline-flex"
                  data-preview-rating={previewRating}
                >
                  <RatingChip rating={previewRating} size="sm" />
                </motion.span>
              ) : (
                <span className="text-sm text-muted">—</span>
              )}
            </AnimatePresence>
            {task.actualMinutes != null && (
              <span className="text-xs text-muted">
                {formatMinutes(task.actualMinutes)} taken against {formatMinutes(minutes)}
              </span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export default AdjustStandardModal;
