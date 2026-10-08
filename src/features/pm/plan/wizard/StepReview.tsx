import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { Avatar, Button, Chip } from '@/components';
import { formatMinutes, type Person, type TaskType } from '@/store';
import { ReviewerChip } from '../ReviewerChip';
import { autoStandard, longDate, quantityText } from '../planShared';
import { TARGET_FIELDS, TEMPLATES, sameTargets, type WizardDraft } from './wizardModel';

export interface StepReviewProps {
  draft: WizardDraft;
  taskTypes: TaskType[];
  people: Person[];
  onEdit: (step: number) => void;
}

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (s: number) => void; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line/70 bg-surface p-4" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
        <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(step)} aria-label={`Edit ${title.toLowerCase()}`}>
          Edit
        </Button>
      </div>
      {children}
    </section>
  );
}

export function StepReview({ draft, taskTypes, people, onEdit }: StepReviewProps) {
  const template = TEMPLATES.find((t) => t.key === draft.template) ?? TEMPLATES[0];
  const ticked = taskTypes.filter((t) => draft.tasks[t.id]?.on);
  const team = people.filter((p) => draft.resourceIds.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
  const pm = people.find((p) => p.id === draft.pmId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Basics" step={0} onEdit={onEdit}>
        <p className="text-lg font-bold leading-snug text-ink">{draft.name.trim()}</p>
        <p className="mt-1 text-sm text-muted">for {draft.client.trim()}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Chip tone="sky">{draft.geography}</Chip>
          <Chip tone="grey">Starts {longDate(draft.startDate)}</Chip>
          {pm && (
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Avatar person={pm} size="xs" decorative /> PM {pm.firstName}
            </span>
          )}
        </div>
      </Section>

      <Section title="Targets" step={1} onEdit={onEdit}>
        <p className="mb-3 text-sm text-muted">
          {template.emoji} {template.label}
          {!sameTargets(draft.targets, template.targets) && <span className="font-semibold text-lavender-ink"> · customised</span>}
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {TARGET_FIELDS.map((f) => (
            <div key={f.key}>
              <dt className="text-xs text-muted">{f.label}</dt>
              <dd className="text-base font-bold tabular-nums text-ink">
                {draft.targets[f.key].toLocaleString()}
                {f.key.startsWith('weekly') && <span className="text-xs font-medium text-muted"> / wk</span>}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title={`Tasks (${ticked.length})`} step={2} onEdit={onEdit}>
        {ticked.length === 0 ? (
          <p className="text-sm text-muted">No tasks ticked.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {ticked.map((tt) => {
              const qty = draft.tasks[tt.id].qty;
              return (
                <li key={tt.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 font-medium text-ink">{tt.name}</span>
                  <span className="tabular-nums text-muted">{quantityText(qty, tt)}</span>
                  <span className="w-14 text-right font-semibold tabular-nums text-ink">{formatMinutes(autoStandard(tt, qty))}</span>
                  <ReviewerChip role={tt.defaultReviewerRole} short />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title={`Team (${team.length})`} step={3} onEdit={onEdit}>
        {team.length === 0 ? (
          <p className="text-sm text-muted">Nobody yet. Tick people in Team so you can plan their days.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {team.map((p) => (
              <li key={p.id} className="inline-flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-3 text-sm font-medium text-ink">
                <Avatar person={p} size="xs" decorative />
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
