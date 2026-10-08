import { useMemo, useState, type ReactNode } from 'react';
import { PresenceContext } from 'framer-motion';
import { Clock3, Plus, Send } from 'lucide-react';
import {
  DEFAULT_TASK_QUANTITIES,
  defaultReviewerFor,
  formatMinutes,
  personById,
  projectsForPerson,
  taskTitle,
  useApp,
} from '@/store';
import type { Priority, Project, TaskType, TimeBlock } from '@/store/types';
import {
  Button,
  EmptyState,
  Field,
  Modal,
  NumberStepper,
  PillToggle,
  SegmentedControl,
  TONE_STRONG_BG,
  cn,
  toast,
} from '@/components';
import { TIME_BLOCKS, TIME_BLOCK_SHORT, useAppData } from './components/helpers';

export interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  personId: string;
  date: string;
}

const PRIORITIES: Priority[] = ['P1', 'P2', 'P3'];

/**
 * Work-around for a framer-motion 11 quirk: SegmentedControl's sliding pill is a
 * `layoutId` element that registers with the nearest AnimatePresence. Each time the
 * selection moves, the old pill unmounts but its registration is never cleared, so
 * the Modal's exit would never complete (the closed dialog stays in the DOM as an
 * invisible overlay). Detaching the control from the Modal's presence avoids that.
 */
function DetachedFromPresence({ children }: { children: ReactNode }) {
  return <PresenceContext.Provider value={null}>{children}</PresenceContext.Provider>;
}

function typesFor(project: Project | undefined, taskTypes: TaskType[]): TaskType[] {
  if (!project) return [];
  return project.taskTypeIds
    .map((id) => taskTypes.find((t) => t.id === id))
    .filter((t): t is TaskType => !!t && !t.archived);
}

function defaultQuantity(project: Project | undefined, taskTypeId: string | undefined): number {
  if (!taskTypeId) return 1;
  return project?.defaultQuantities[taskTypeId] ?? DEFAULT_TASK_QUANTITIES[taskTypeId] ?? 1;
}

/**
 * Self-added task: project pills, the project's task library as tiles, a quantity
 * stepper, time block + priority pills and the computed standard.
 * Mount with a fresh `key` per opening so it always starts clean.
 */
export function AddTaskModal({ open, onClose, personId, date }: AddTaskModalProps) {
  const data = useAppData();
  const addTask = useApp((s) => s.addTask);

  const projects = useMemo(
    () => projectsForPerson(data, personId).filter((p) => p.status === 'active'),
    [data, personId],
  );

  const [projectId, setProjectId] = useState<string | undefined>(() => projects[0]?.id);
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  const types = useMemo(() => typesFor(project, data.taskTypes), [project, data.taskTypes]);

  const [taskTypeId, setTaskTypeId] = useState<string | undefined>(() => types[0]?.id);
  const taskType = types.find((t) => t.id === taskTypeId);
  const [quantity, setQuantity] = useState(() => defaultQuantity(project, types[0]?.id));
  const [timeBlock, setTimeBlock] = useState<TimeBlock>('anytime');
  const [priority, setPriority] = useState<Priority>('P2');

  const pickProject = (id: string) => {
    if (id === project?.id) return;
    const next = projects.find((p) => p.id === id);
    setProjectId(id);
    const nextTypes = typesFor(next, data.taskTypes);
    // Keep the task type when the new project offers it too.
    const keep = nextTypes.find((t) => t.id === taskTypeId);
    const tt = keep ?? nextTypes[0];
    setTaskTypeId(tt?.id);
    if (!keep) setQuantity(defaultQuantity(next, tt?.id));
  };

  const pickType = (id: string) => {
    setTaskTypeId(id);
    setQuantity(defaultQuantity(project, id));
  };

  const standard = taskType ? Math.max(1, Math.round(quantity * taskType.standardMinutesPerUnit)) : 0;
  const reviewer = personById(data.people, defaultReviewerFor(taskType, project));
  const canAdd = !!project && !!taskType && quantity >= 1;

  const submit = () => {
    if (!project || !taskType) return;
    addTask({ assigneeId: personId, projectId: project.id, taskTypeId: taskType.id, quantity, date, priority, timeBlock });
    toast({
      title: `Added to your day: ${taskTitle(taskType, quantity)}`,
      description: `${TIME_BLOCK_SHORT[timeBlock]} · standard ${formatMinutes(standard)}`,
      emoji: '📝',
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add a task"
      description="Pick from your project's task library — the standard time is worked out for you."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Plus} onClick={submit} disabled={!canAdd}>
            Add to my day
          </Button>
        </>
      }
    >
      {projects.length === 0 ? (
        <EmptyState compact emoji="🗂️" title="No projects yet" description="Once your PM adds you to a project, its tasks show up here." />
      ) : (
        <div className="space-y-6">
          <Field label="Project">
            <div className="flex flex-wrap gap-2">
              {projects.map((p) => (
                <PillToggle key={p.id} pressed={p.id === project?.id} onChange={() => pickProject(p.id)} size="sm">
                  <span aria-hidden className={cn('h-2 w-2 rounded-full', TONE_STRONG_BG[p.color])} />
                  {p.name}
                </PillToggle>
              ))}
            </div>
          </Field>

          <Field label="Task">
            {types.length === 0 ? (
              <p className="text-sm text-muted">This project has no task types yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {types.map((t) => {
                  const selected = t.id === taskType?.id;
                  const rev = personById(data.people, defaultReviewerFor(t, project));
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => pickType(t.id)}
                      data-testid="task-type-tile"
                      className={cn(
                        'focus-ring flex min-h-[4rem] flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition duration-150 active:scale-[0.98]',
                        selected
                          ? 'border-accent/60 bg-accent-soft shadow-soft'
                          : 'border-line bg-surface hover:border-faint/50 hover:bg-surface-2',
                      )}
                    >
                      <span className={cn('text-sm font-semibold leading-snug', selected ? 'text-accent-ink' : 'text-ink')}>
                        {t.name}
                      </span>
                      <span className="text-xs text-muted">
                        {t.standardMinutesPerUnit} min / {t.unitSingular}
                      </span>
                      {rev && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                          <Send className="h-3 w-3" aria-hidden /> Reviewed by {rev.firstName}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Quantity">
              <div className="flex items-center gap-2">
                <NumberStepper
                  value={quantity}
                  onChange={(n) => setQuantity(Math.max(1, Math.round(n)))}
                  min={1}
                  max={999}
                  ariaLabel="Quantity"
                />
                {taskType && <span className="text-sm text-muted">{quantity === 1 ? taskType.unitSingular : taskType.unit}</span>}
              </div>
            </Field>
            <div
              className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3"
              aria-live="polite"
              data-testid="computed-standard"
            >
              <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-accent-ink">
                <Clock3 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">Standard time</p>
                <p className="text-base font-bold tabular-nums text-ink">
                  {formatMinutes(standard)}
                  {taskType && (
                    <span className="ml-1.5 text-xs font-medium text-muted">
                      {quantity} × {taskType.standardMinutesPerUnit} min
                    </span>
                  )}
                </p>
                {reviewer && <p className="text-[11px] text-muted">Goes to {reviewer.firstName} for review when done</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Time block">
              <DetachedFromPresence>
                <SegmentedControl
                  ariaLabel="Time block"
                  value={timeBlock}
                  onChange={setTimeBlock}
                  options={TIME_BLOCKS.map((b) => ({ value: b, label: TIME_BLOCK_SHORT[b] }))}
                  size="sm"
                  fullWidth
                />
              </DetachedFromPresence>
            </Field>
            <Field label="Priority">
              <DetachedFromPresence>
                <SegmentedControl
                  ariaLabel="Priority"
                  value={priority}
                  onChange={setPriority}
                  options={PRIORITIES.map((p) => ({ value: p, label: p }))}
                  size="sm"
                  fullWidth
                />
              </DetachedFromPresence>
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default AddTaskModal;
