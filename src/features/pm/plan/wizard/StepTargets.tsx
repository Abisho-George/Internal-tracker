import { useId } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, NumberStepper, cn } from '@/components';
import { formatMinutes, type ProjectTargets, type TaskType } from '@/store';
import { PillRadio } from '../PillRadio';
import { TARGET_FIELDS, TEMPLATES, sameTargets, type TemplateKey, type WizardDraft, type WizardUpdate } from './wizardModel';

export interface StepTargetsProps {
  draft: WizardDraft;
  update: WizardUpdate;
  taskTypes: TaskType[];
  workdayHours: number;
}

/** Rough weekly messaging effort from the library's per-message standards. */
function weeklyMessagingMinutes(targets: ProjectTargets, taskTypes: TaskType[]): number {
  const per = (level: 1 | 2 | 3, fallback: number) =>
    taskTypes.find((t) => t.messageLevel === level && !t.archived)?.standardMinutesPerUnit ?? fallback;
  return targets.weeklyMessagesL1 * per(1, 3) + targets.weeklyMessagesL2 * per(2, 4) + targets.weeklyMessagesL3 * per(3, 5);
}

function peopleText(peopleWeeks: number): string {
  const p = Math.max(0.1, Math.round(peopleWeeks * 10) / 10);
  if (p < 1) return `${p} of a person's week`;
  if (p === 1) return "one person's full week";
  return `${p} people's weeks`;
}

export function StepTargets({ draft, update, taskTypes, workdayHours }: StepTargetsProps) {
  const templateLabel = useId();
  const template = TEMPLATES.find((t) => t.key === draft.template) ?? TEMPLATES[0];
  const customised = !sameTargets(draft.targets, template.targets);
  const weekly = weeklyMessagingMinutes(draft.targets, taskTypes);
  const peopleWeeks = weekly / (workdayHours * 60 * 5);

  const pickTemplate = (key: TemplateKey) => {
    const def = TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
    update({ template: key, targets: { ...def.targets } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <span id={templateLabel} className="text-sm font-semibold text-ink">
          Template
        </span>
        <PillRadio<TemplateKey>
          labelledBy={templateLabel}
          size="md"
          showCheck
          value={draft.template}
          onChange={pickTemplate}
          options={TEMPLATES.map((t) => ({
            value: t.key,
            label: (
              <>
                <span aria-hidden>{t.emoji}</span> {t.label}
              </>
            ),
            ariaLabel: t.label,
          }))}
        />
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span>{template.description}</span>
          {customised && (
            <>
              <span className="font-semibold text-lavender-ink">· Customised</span>
              <Button variant="ghost" size="sm" icon={RotateCcw} className="h-7 px-2" onClick={() => pickTemplate(template.key)}>
                Reset to template
              </Button>
            </>
          )}
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Targets">
        {TARGET_FIELDS.map((f) => {
          const changed = draft.targets[f.key] !== template.targets[f.key];
          return (
            <li
              key={f.key}
              className={cn(
                'flex items-center justify-between gap-3 rounded-2xl border bg-surface p-4 transition-colors',
                changed ? 'border-lavender-strong/60' : 'border-line/70',
              )}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span aria-hidden>{f.emoji}</span>
                  {f.label}
                </p>
                <p className="mt-0.5 text-xs text-muted">{f.hint}</p>
              </div>
              <NumberStepper
                ariaLabel={`${f.label} target`}
                value={draft.targets[f.key]}
                min={0}
                max={f.max}
                step={f.step}
                onChange={(v) => update({ targets: { ...draft.targets, [f.key]: Math.round(v) } })}
              />
            </li>
          );
        })}
      </ul>

      <p className="rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-ink">
        <span aria-hidden>💡 </span>
        That's about <strong className="font-bold">{formatMinutes(weekly)}</strong> of messaging a week
        {peopleWeeks > 0 && (
          <>
            {' '}
            — roughly{' '}
            <strong className="font-bold">{peopleText(peopleWeeks)}</strong>
          </>
        )}
        .
      </p>
    </div>
  );
}
