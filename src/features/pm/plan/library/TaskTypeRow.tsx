import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Archive, Check, Pencil } from 'lucide-react';
import { Button, IconButton, NumberStepper, TONE_SOFT, TextInput, cn } from '@/components';
import type { ReviewerRole, TaskCategory, TaskType } from '@/store';
import { CategoryChip, ReviewerChip } from '../ReviewerChip';
import { CATEGORIES, CATEGORY_ICON, CATEGORY_TONE, REVIEWER_ROLES, REVIEWER_ROLE_OPTION, singularOf } from '../planShared';

export interface TaskTypeRowProps {
  taskType: TaskType;
  onSave: (taskType: TaskType) => void;
  onArchive: (taskType: TaskType) => void;
}

function differs(a: TaskType, b: TaskType): boolean {
  return (
    a.name !== b.name ||
    a.unit !== b.unit ||
    a.standardMinutesPerUnit !== b.standardMinutesPerUnit ||
    a.defaultReviewerRole !== b.defaultReviewerRole ||
    a.category !== b.category
  );
}

/**
 * One task type. The standard minutes are always an inline stepper; "Edit"
 * opens the rest of the row. Any change shows Save / Cancel for the row.
 */
export function TaskTypeRow({ taskType, onSave, onArchive }: TaskTypeRowProps) {
  const [draft, setDraft] = useState<TaskType>(taskType);
  const [editing, setEditing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  // Follow outside updates while the row is untouched.
  useEffect(() => {
    if (!editing) setDraft(taskType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskType]);

  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);

  const dirty = differs(draft, taskType);
  const pending = editing || dirty;
  const valid = draft.name.trim().length > 0 && draft.unit.trim().length > 0;
  const Icon = CATEGORY_ICON[draft.category];

  const cancel = () => {
    setDraft(taskType);
    setEditing(false);
    window.setTimeout(() => editButtonRef.current?.focus(), 0);
  };
  const save = () => {
    if (!valid) return;
    const unit = draft.unit.trim();
    onSave({
      ...taskType,
      ...draft,
      name: draft.name.trim(),
      unit,
      unitSingular: unit === taskType.unit ? taskType.unitSingular : singularOf(unit),
    });
    setEditing(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && pending) {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && pending && (e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).inputMode !== 'decimal') {
      e.preventDefault();
      save();
    }
  };

  return (
    <tr
      onKeyDown={onKeyDown}
      className={cn('border-t border-line/60 align-middle transition-colors', pending ? 'bg-accent-soft/40' : 'hover:bg-surface-2/50')}
      data-testid={`tt-row-${taskType.id}`}
    >
      <td className="min-w-[10rem] py-3 pl-5 pr-3">
        {editing ? (
          <div className="flex max-w-[16rem] flex-col gap-1.5">
            <TextInput
              ref={nameRef}
              aria-label="Task name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="h-9 py-1"
              invalid={!draft.name.trim()}
              maxLength={60}
            />
            <TextInput
              aria-label="Unit (plural, e.g. messages)"
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              className="h-8 py-1 text-xs"
              invalid={!draft.unit.trim()}
              maxLength={24}
              placeholder="unit"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span aria-hidden className={cn('hidden h-8 w-8 shrink-0 items-center justify-center rounded-xl lg:inline-flex', TONE_SOFT[CATEGORY_TONE[draft.category]])}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{taskType.name}</p>
              <p className="text-xs text-muted">Counted in {taskType.unit}</p>
            </div>
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <NumberStepper
            size="sm"
            ariaLabel={`Standard minutes per ${draft.unitSingular || 'unit'} for ${taskType.name}`}
            value={draft.standardMinutesPerUnit}
            min={1}
            max={480}
            step={1}
            onChange={(v) => setDraft({ ...draft, standardMinutesPerUnit: Math.max(1, Math.round(v)) })}
          />
          <span className="whitespace-nowrap text-xs text-muted">min / {editing ? singularOf(draft.unit) || 'unit' : taskType.unitSingular}</span>
        </div>
      </td>
      <td className="px-3 py-3">
        {editing ? (
          <select
            aria-label={`Default reviewer for ${taskType.name}`}
            value={draft.defaultReviewerRole}
            onChange={(e) => setDraft({ ...draft, defaultReviewerRole: e.target.value as ReviewerRole })}
            className="input h-8 w-auto cursor-pointer py-0 pl-2.5 pr-7 text-xs font-semibold"
          >
            {REVIEWER_ROLES.map((r) => (
              <option key={r} value={r}>
                {REVIEWER_ROLE_OPTION[r]}
              </option>
            ))}
          </select>
        ) : (
          <ReviewerChip role={taskType.defaultReviewerRole} short />
        )}
      </td>
      <td className="px-3 py-3">
        {editing ? (
          <select
            aria-label={`Category for ${taskType.name}`}
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as TaskCategory })}
            className="input h-8 w-auto cursor-pointer py-0 pl-2.5 pr-7 text-xs font-semibold"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : (
          <CategoryChip category={taskType.category} />
        )}
      </td>
      <td className="py-3 pl-3 pr-5">
        <div className={cn('flex items-center justify-end gap-1', pending && 'flex-col-reverse items-end xl:flex-row xl:items-center')}>
          {pending ? (
            <>
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
              <Button size="sm" icon={Check} onClick={save} disabled={!valid || !dirty} aria-label={`Save ${taskType.name}`}>
                Save
              </Button>
            </>
          ) : (
            <>
              <IconButton ref={editButtonRef} label={`Edit ${taskType.name}`} icon={Pencil} size="sm" onClick={() => setEditing(true)} />
              <IconButton label={`Archive ${taskType.name}`} icon={Archive} size="sm" onClick={() => onArchive(taskType)} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
