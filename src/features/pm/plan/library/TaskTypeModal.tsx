import { useEffect, useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button, Field, Modal, NumberStepper, TextInput } from '@/components';
import { formatMinutes, type ReviewerRole, type TaskCategory, type TaskType } from '@/store';
import { PillRadio } from '../PillRadio';
import { CATEGORIES, CATEGORY_ICON, REVIEWER_ROLES, REVIEWER_ROLE_OPTION, localId, singularOf } from '../planShared';

export interface TaskTypeModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (taskType: TaskType) => void;
  existingNames: string[];
}

const UNIT_SUGGESTIONS = ['messages', 'companies', 'calls', 'posts', 'records', 'sessions'];

/** "Add task type" dialog. */
export function TaskTypeModal({ open, onClose, onAdd, existingNames }: TaskTypeModalProps) {
  const categoryLabel = useId();
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [reviewer, setReviewer] = useState<ReviewerRole>('none');
  const [category, setCategory] = useState<TaskCategory>('Outreach');

  useEffect(() => {
    if (open) {
      setName('');
      setUnit('');
      setMinutes(10);
      setReviewer('none');
      setCategory('Outreach');
    }
  }, [open]);

  const duplicate = existingNames.some((n) => n.toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim().length > 0 && unit.trim().length > 0 && !duplicate;

  const add = () => {
    if (!valid) return;
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20);
    const u = unit.trim();
    onAdd({
      id: localId(`tt-${slug || 'custom'}`),
      name: name.trim(),
      unit: u,
      unitSingular: singularOf(u),
      standardMinutesPerUnit: minutes,
      defaultReviewerRole: reviewer,
      category,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a task type"
      description="It's ready to plan straight away. Changes apply to new tasks only."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={Plus} onClick={add} disabled={!valid}>
            Add task type
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field
            label="Name"
            hint={duplicate ? <span className="font-semibold text-butter-ink">That one's already in the library.</span> : undefined}
          >
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. LinkedIn post" autoFocus maxLength={60} invalid={duplicate} />
          </Field>
          <Field label="Unit" hint="Plural, e.g. posts">
            <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="posts" list="tt-unit-suggestions" maxLength={24} />
          </Field>
          <datalist id="tt-unit-suggestions">
            {UNIT_SUGGESTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>

        <Field label="Standard time per unit" hint={`10 ${unit.trim() || 'units'} ≈ ${formatMinutes(minutes * 10)}`}>
          <div>
            <NumberStepper ariaLabel="Standard minutes per unit" value={minutes} min={1} max={480} onChange={(v) => setMinutes(Math.max(1, Math.round(v)))} suffix="min" />
          </div>
        </Field>

        <Field label="Default reviewer">
          <div>
            <PillRadio<ReviewerRole>
              ariaLabel="Default reviewer"
              size="sm"
              showCheck
              value={reviewer}
              onChange={setReviewer}
              options={REVIEWER_ROLES.map((r) => ({ value: r, label: REVIEWER_ROLE_OPTION[r] }))}
            />
          </div>
        </Field>

        <div className="flex flex-col gap-1.5">
          <span id={categoryLabel} className="text-sm font-semibold text-ink">
            Category
          </span>
          <PillRadio<TaskCategory>
            labelledBy={categoryLabel}
            size="sm"
            value={category}
            onChange={setCategory}
            options={CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICON[c];
              return {
                value: c,
                ariaLabel: c,
                label: (
                  <>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    {c}
                  </>
                ),
              };
            })}
          />
        </div>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
