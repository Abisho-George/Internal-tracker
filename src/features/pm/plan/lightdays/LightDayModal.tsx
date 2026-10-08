import { useEffect, useId, useRef, useState } from 'react';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { Button, Chip, Field, Modal, PillToggle, ProjectChip, TextInput } from '@/components';
import { PillRadio } from '../PillRadio';
import { formatMinutes, type LightDay, type NewLightDayInput, type Project } from '@/store';
import { longDate } from '../planShared';

export const QUICK_REASONS = ['Team offsite', 'Festival', 'Training day'];

export type LightDayModalState = { mode: 'add'; date: string } | { mode: 'details'; date: string } | null;

export interface LightDayModalProps {
  state: LightDayModalState;
  onClose: () => void;
  /** Light days on the selected date. */
  existing: LightDay[];
  projects: Project[];
  workdayMinutes: number;
  onAdd: (input: NewLightDayInput) => void;
  onRemove: (ld: LightDay) => void;
  onAddAnother: (date: string) => void;
}

export function LightDayModal({ state, onClose, existing, projects, workdayMinutes, onAdd, onRemove, onAddAnother }: LightDayModalProps) {
  const projectsLabel = useId();
  const [scope, setScope] = useState<string[] | 'all'>('all');
  const [reason, setReason] = useState('');
  const [pct, setPct] = useState<50 | 75>(50);

  // Keep showing the last content while the dialog animates out.
  const last = useRef<LightDayModalState>(null);
  if (state) last.current = state;
  const shown = state ?? last.current;
  const date = shown?.date ?? '';
  useEffect(() => {
    if (state?.mode === 'add') {
      setScope('all');
      setReason('');
      setPct(50);
    }
  }, [state?.mode, state?.date]);

  const toggleProject = (id: string, on: boolean) => {
    const current = scope === 'all' ? [] : scope;
    const next = on ? [...current, id] : current.filter((x) => x !== id);
    setScope(next.length === 0 || next.length === projects.length ? 'all' : next);
  };

  const save = () => {
    onAdd({ date, projectIds: scope, reason: reason.trim() || 'Light day', adjustedTargetPercent: pct });
  };

  const details = (
    <ul className="space-y-3">
      {existing.map((ld) => {
        const scoped = ld.projectIds === 'all' ? [] : projects.filter((p) => (ld.projectIds as string[]).includes(p.id));
        return (
          <li key={ld.id} className="rounded-2xl border border-butter-strong/60 bg-butter-soft/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-ink">
                  <span aria-hidden>🌤️ </span>
                  {ld.reason}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Targets at <strong className="font-semibold text-ink">{ld.adjustedTargetPercent}%</strong> — about{' '}
                  {formatMinutes(Math.round((workdayMinutes * ld.adjustedTargetPercent) / 100))} instead of {formatMinutes(workdayMinutes)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {ld.projectIds === 'all' ? <Chip tone="lavender">All projects</Chip> : scoped.map((p) => <ProjectChip key={p.id} project={p} />)}
                </div>
              </div>
              <Button variant="secondary" size="sm" icon={Trash2} onClick={() => onRemove(ld)} aria-label={`Remove light day: ${ld.reason}`}>
                Remove
              </Button>
            </div>
          </li>
        );
      })}
      {existing.length === 0 && <li className="text-sm text-muted">No light days on this date any more.</li>}
    </ul>
  );

  const addForm = (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex flex-col gap-2">
        <span id={projectsLabel} className="text-sm font-semibold text-ink">
          Projects
        </span>
        <div role="group" aria-labelledby={projectsLabel} className="flex flex-wrap gap-2">
          <PillToggle size="sm" showCheck pressed={scope === 'all'} onChange={() => setScope('all')}>
            All projects
          </PillToggle>
          {projects.map((p) => (
            <PillToggle
              key={p.id}
              size="sm"
              showCheck
              pressed={scope !== 'all' && scope.includes(p.id)}
              onChange={(on) => toggleProject(p.id, on)}
              title={p.name}
            >
              {p.client}
            </PillToggle>
          ))}
        </div>
      </div>

      <Field label="Reason" hint="Shown next to the target line on My Day.">
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Team offsite" maxLength={60} autoFocus />
      </Field>
      <div className="-mt-3 flex flex-wrap gap-2" role="group" aria-label="Quick reasons">
        {QUICK_REASONS.map((r) => (
          <PillToggle key={r} size="sm" pressed={reason === r} onChange={() => setReason(r)}>
            {r}
          </PillToggle>
        ))}
      </div>

      <Field label="Target for the day" hint={`About ${formatMinutes(Math.round((workdayMinutes * pct) / 100))} instead of ${formatMinutes(workdayMinutes)}.`}>
        <div>
          <PillRadio<50 | 75>
            ariaLabel="Target percent"
            size="md"
            showCheck
            value={pct}
            onChange={setPct}
            options={[
              { value: 50, label: '50%' },
              { value: 75, label: '75%' },
            ]}
          />
        </div>
      </Field>
      <button type="submit" hidden aria-hidden tabIndex={-1} />
    </form>
  );

  const isDetails = shown?.mode === 'details';
  return (
    <Modal
      open={!!state}
      onClose={onClose}
      title={isDetails ? `Light day · ${longDate(date)}` : 'Add a light day'}
      description={isDetails ? 'Everyone on these projects sees a lighter target on their My Day progress line.' : date ? longDate(date) : undefined}
      footer={
        isDetails ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button variant="soft" icon={CalendarPlus} onClick={() => onAddAnother(date)}>
              Add another
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={CalendarPlus} onClick={save}>
              Save light day
            </Button>
          </>
        )
      }
    >
      {isDetails ? details : addForm}
    </Modal>
  );
}
