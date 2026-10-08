import { ListChecks, RotateCcw } from 'lucide-react';
import { Button, Checkbox, NumberStepper, cn } from '@/components';
import { STANDARD_OUTBOUND_TASK_TYPE_IDS, formatMinutes, type TaskType } from '@/store';
import { CategoryChip, ReviewerChip } from '../ReviewerChip';
import { autoStandard, perUnitText } from '../planShared';
import type { WizardDraft, WizardUpdate } from './wizardModel';

export interface StepTasksProps {
  draft: WizardDraft;
  update: WizardUpdate;
  /** Non-archived task types, library order. */
  taskTypes: TaskType[];
  showHints: boolean;
}

export function StepTasks({ draft, update, taskTypes, showHints }: StepTasksProps) {
  const picks = draft.tasks;
  const ticked = taskTypes.filter((t) => picks[t.id]?.on);
  const total = ticked.reduce((s, t) => s + autoStandard(t, picks[t.id].qty), 0);

  const setPick = (id: string, patch: Partial<{ on: boolean; qty: number }>) =>
    update({ tasks: { ...picks, [id]: { ...picks[id], ...patch } } });

  const tickAll = () => update({ tasks: Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, { ...p, on: true }])) });
  const standardSet = () =>
    update({
      tasks: Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, { ...p, on: STANDARD_OUTBOUND_TASK_TYPE_IDS.includes(id) }])),
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          <strong className="font-bold text-ink">{ticked.length}</strong> of {taskTypes.length} ticked
          {ticked.length > 0 && (
            <>
              {' '}
              · one round of each ≈ <strong className="font-semibold text-ink">{formatMinutes(total)}</strong>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" icon={ListChecks} onClick={tickAll}>
            Tick all
          </Button>
          <Button variant="ghost" size="sm" icon={RotateCcw} onClick={standardSet}>
            Standard set
          </Button>
        </div>
      </div>

      {showHints && ticked.length === 0 && (
        <p className="rounded-2xl bg-butter-soft px-4 py-3 text-sm font-semibold text-butter-ink">
          Tick at least one task so the team has something to plan 🙂
        </p>
      )}

      <ul className="space-y-2" aria-label="Task library">
        {taskTypes.map((tt) => {
          const pick = picks[tt.id] ?? { on: false, qty: 1 };
          const std = autoStandard(tt, pick.qty);
          return (
            <li
              key={tt.id}
              className={cn(
                'grid items-center gap-x-4 gap-y-2 rounded-2xl border p-3 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto_7.5rem_11rem]',
                pick.on ? 'border-accent/40 bg-surface shadow-soft' : 'border-line/70 bg-surface-2/40',
              )}
            >
              <Checkbox
                checked={pick.on}
                onChange={(on) => setPick(tt.id, { on })}
                label={tt.name}
                description={
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <CategoryChip category={tt.category} />
                    <span>{perUnitText(tt)}</span>
                  </span>
                }
              />
              {pick.on ? (
                <>
                  <div className="flex items-center gap-2 sm:justify-self-end">
                    <NumberStepper
                      size="sm"
                      ariaLabel={`Default quantity for ${tt.name}`}
                      value={pick.qty}
                      min={1}
                      max={999}
                      step={tt.standardMinutesPerUnit >= 10 ? 1 : 5}
                      onChange={(qty) => setPick(tt.id, { qty: Math.max(1, Math.round(qty)) })}
                    />
                    <span className="w-16 truncate text-xs text-muted">{pick.qty === 1 ? tt.unitSingular : tt.unit}</span>
                  </div>
                  <div className="text-sm lg:text-right">
                    <span className="font-semibold tabular-nums text-ink">{formatMinutes(std)}</span>
                    <span className="sr-only"> standard time</span>
                    <span className="block text-[11px] text-muted">
                      {pick.qty} × {tt.standardMinutesPerUnit} min
                    </span>
                  </div>
                  <div className="lg:justify-self-end">
                    <ReviewerChip role={tt.defaultReviewerRole} />
                  </div>
                </>
              ) : (
                <span className="hidden text-xs text-faint sm:block sm:justify-self-end lg:col-span-3">Not on this project</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
