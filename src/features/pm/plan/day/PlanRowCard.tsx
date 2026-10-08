import { useId, type ReactNode } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { IconButton, NumberStepper, ProjectChip, TONE_SOFT, cn } from '@/components';
import { formatMinutes, type Person, type Priority, type Project, type TaskType, type TimeBlock } from '@/store';
import { PillRadio } from '../PillRadio';
import { CATEGORY_ICON, CATEGORY_TONE, autoStandard, perUnitText } from '../planShared';
import { PRIORITIES, TIME_BLOCK_OPTIONS, type DraftRow } from './planModel';

export interface ReviewerOption {
  id: string; // '' = no review
  label: string;
}

export interface PlanRowCardProps {
  row: DraftRow;
  taskType: TaskType | undefined;
  project: Project | undefined;
  reviewerOptions: ReviewerOption[];
  onChange: (patch: Partial<DraftRow>) => void;
  onRemove: () => void;
}

const PRIORITY_TONE = { P1: 'coral', P2: 'sky', P3: 'grey' } as const;

function Control({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={cn('flex flex-col gap-1', className)}>
      <span id={id} className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function InlineControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="text-[11px] font-semibold uppercase tracking-wide text-faint">
        {label}
      </span>
      {children}
    </div>
  );
}

/** One editable row of the day plan. */
export function PlanRowCard({ row, taskType, project, reviewerOptions, onChange, onRemove }: PlanRowCardProps) {
  const name = taskType?.name ?? row.title ?? 'Task';
  const auto = autoStandard(taskType, row.quantity);
  const Icon = taskType ? CATEGORY_ICON[taskType.category] : null;
  const unit = taskType ? (row.quantity === 1 ? taskType.unitSingular : taskType.unit) : '';

  const setQuantity = (q: number) => {
    const quantity = Math.max(1, Math.round(q));
    onChange(row.overridden ? { quantity } : { quantity, standardMinutes: autoStandard(taskType, quantity) });
  };
  const setStandard = (m: number) => {
    const standardMinutes = Math.max(1, Math.round(m));
    onChange({ standardMinutes, overridden: standardMinutes !== auto });
  };

  return (
    <div className="rounded-2xl border border-line/70 bg-surface p-3 shadow-soft sm:p-4" data-testid="plan-row">
      <div className="flex items-start gap-3">
        {Icon && taskType && (
          <span aria-hidden className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', TONE_SOFT[CATEGORY_TONE[taskType.category]])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-ink">
            {name}
            {!row.taskId && (
              <span className="ml-2 rounded-full bg-lavender-soft px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-lavender-ink">
                New
              </span>
            )}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            {project && <ProjectChip project={project} short />}
            {taskType && <span>{perUnitText(taskType)}</span>}
          </div>
        </div>
        <IconButton label={`Remove ${name}`} icon={X} size="sm" onClick={onRemove} tooltipSide="left" />
      </div>

      <div className="mt-3 flex flex-wrap items-start gap-x-4 gap-y-3">
        <Control label="Quantity">
          <NumberStepper
            size="sm"
            ariaLabel={`Quantity for ${name}`}
            value={row.quantity}
            min={1}
            max={999}
            step={taskType && taskType.standardMinutesPerUnit < 10 ? 5 : 1}
            onChange={setQuantity}
          />
          <span className="max-w-[5.5rem] truncate text-xs text-muted">{unit}</span>
        </Control>

        <Control label="Standard">
          <NumberStepper
            size="sm"
            ariaLabel={`Standard minutes for ${name}`}
            value={row.standardMinutes}
            min={1}
            max={960}
            step={5}
            suffix="min"
            onChange={setStandard}
          />
          <span className="flex min-w-[3.5rem] flex-col items-start leading-tight">
            <span className="text-xs font-bold tabular-nums text-ink">{formatMinutes(row.standardMinutes)}</span>
            {row.overridden ? (
              <button
                type="button"
                onClick={() => onChange({ standardMinutes: auto, overridden: false })}
                className="focus-ring -ml-1 mt-0.5 inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1 text-[11px] font-semibold text-accent-ink underline-offset-2 hover:bg-accent-soft hover:underline"
                aria-label={`Reset standard for ${name} to auto (${formatMinutes(auto)})`}
                title={`Back to ${row.quantity} × ${taskType?.standardMinutesPerUnit ?? '?'} min = ${formatMinutes(auto)}`}
              >
                <RotateCcw className="h-2.5 w-2.5" aria-hidden />
                reset to auto
              </button>
            ) : (
              <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-mint-ink" title="Quantity × standard per unit">
                ✓ Auto
              </span>
            )}
          </span>
        </Control>

        <Control label="Reviewer">
          <select
            aria-label={`Reviewer for ${name}`}
            value={row.reviewerId}
            onChange={(e) => onChange({ reviewerId: e.target.value })}
            className="input h-8 w-auto cursor-pointer py-0 pl-2.5 pr-8 text-xs font-semibold"
          >
            {reviewerOptions.map((o) => (
              <option key={o.id || 'none'} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </Control>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line/60 pt-3">
        <InlineControl label="Priority">
          <PillRadio<Priority>
            ariaLabel={`Priority for ${name}`}
            size="xs"
            value={row.priority}
            onChange={(priority) => onChange({ priority })}
            options={PRIORITIES.map((p) => ({ value: p, label: p, tone: PRIORITY_TONE[p], ariaLabel: `Priority ${p.slice(1)}` }))}
          />
        </InlineControl>
        <InlineControl label="When">
          <PillRadio<TimeBlock>
            ariaLabel={`Time block for ${name}`}
            size="xs"
            value={row.timeBlock}
            onChange={(timeBlock) => onChange({ timeBlock })}
            options={TIME_BLOCK_OPTIONS.map((b) => ({
              value: b.value,
              label: b.label,
              ariaLabel: b.value === 'morning' ? 'Morning (first 4 hours)' : b.label,
            }))}
          />
        </InlineControl>
      </div>
    </div>
  );
}

/** Reviewer choices for a row: the project's PM, the management reviewer, or no review. */
export function reviewerOptionsFor(project: Project | undefined, people: Person[], managementReviewerId: string, current: string): ReviewerOption[] {
  const pm = people.find((p) => p.id === project?.pmId);
  const mgmt = people.find((p) => p.id === managementReviewerId);
  const opts: ReviewerOption[] = [];
  if (pm) opts.push({ id: pm.id, label: `${pm.firstName} (PM)` });
  if (mgmt) opts.push({ id: mgmt.id, label: `${mgmt.firstName} (Management)` });
  opts.push({ id: '', label: 'No review' });
  if (current && !opts.some((o) => o.id === current)) {
    const other = people.find((p) => p.id === current);
    if (other) opts.splice(opts.length - 1, 0, { id: other.id, label: other.firstName });
  }
  return opts;
}
