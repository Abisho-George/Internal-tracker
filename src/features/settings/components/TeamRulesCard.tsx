import { useMemo, useState } from 'react';
import { BellRing, Clock3, Lock, Save, Scale, Undo2 } from 'lucide-react';
import { DEFAULT_SETTINGS, peopleByRole, useApp, useCurrentUser, useSettings } from '@/store';
import type { Rating, Settings } from '@/store/types';
import { Button, Card, NumberStepper, RatingChip, SectionHeader, SegmentedControl, cn, toast } from '@/components';

type Interval = Settings['approvalReminderMinutes'];
const INTERVALS: Interval[] = [15, 30, 60];

const toPct = (ratio: number) => Math.round(ratio * 100);

interface Draft {
  betterPct: number;
  canDoBetterPct: number;
  workdayHours: number;
  approvalReminderMinutes: Interval;
}

function draftFrom(s: Settings): Draft {
  return {
    betterPct: toPct(s.betterThreshold),
    canDoBetterPct: toPct(s.canDoBetterThreshold),
    workdayHours: s.workdayHours,
    approvalReminderMinutes: s.approvalReminderMinutes,
  };
}

/** "Done in ≤ 90% … → Better ✦" lines for the current thresholds. */
function RatingExplainer({ betterPct, canDoBetterPct }: { betterPct: number; canDoBetterPct: number }) {
  const rows: { rating: Rating; text: string }[] = [
    { rating: 'Better', text: `Done in ≤ ${betterPct}% of the standard time → Better ✦` },
    { rating: 'Optimal', text: `Between ${betterPct}% and ${canDoBetterPct}% → Optimal ✓` },
    { rating: 'Can do better', text: `More than ${canDoBetterPct}% → Can do better ↗` },
  ];
  const example = 60;
  return (
    <div className="rounded-2xl bg-surface-2 p-4" data-testid="rating-explainer">
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.rating} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 text-sm text-ink">
            <span>
              <RatingChip rating={r.rating} size="sm" />
            </span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">
        e.g. a {example}-min task: up to {Math.floor((example * betterPct) / 100)} min is Better, up to{' '}
        {Math.floor((example * canDoBetterPct) / 100)} min is Optimal. A PM can still adjust a task's standard for the day.
      </p>
    </div>
  );
}

/** Team-wide rules: rating thresholds, workday hours, review reminder interval. Management edits; others read. */
export function TeamRulesCard() {
  const me = useCurrentUser();
  const settings = useSettings();
  const people = useApp((s) => s.people);
  const updateSettings = useApp((s) => s.updateSettings);
  const editable = me.role === 'management';
  const [draft, setDraft] = useState<Draft>(() => draftFrom(settings));

  const saved = useMemo(() => draftFrom(settings), [settings]);
  const dirty =
    draft.betterPct !== saved.betterPct ||
    draft.canDoBetterPct !== saved.canDoBetterPct ||
    draft.workdayHours !== saved.workdayHours ||
    draft.approvalReminderMinutes !== saved.approvalReminderMinutes;
  const isDefault =
    JSON.stringify(draft) === JSON.stringify(draftFrom(DEFAULT_SETTINGS));

  const managers = peopleByRole(people, 'management').map((p) => p.firstName);
  const managerText = managers.length > 1 ? `${managers.slice(0, -1).join(', ')} or ${managers[managers.length - 1]}` : managers[0] ?? 'management';

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const save = () => {
    updateSettings({
      betterThreshold: draft.betterPct / 100,
      canDoBetterThreshold: draft.canDoBetterPct / 100,
      workdayHours: draft.workdayHours,
      approvalReminderMinutes: draft.approvalReminderMinutes,
    });
    toast({ title: 'Team rules updated', description: 'Ratings and reminders use the new rules right away.', emoji: '⚖️' });
  };

  const values = editable ? draft : saved;

  return (
    <Card as="section" aria-labelledby="rules-title" className="p-5 sm:p-6" data-testid="rules-card">
      <SectionHeader
        id="rules-title"
        icon={Scale}
        tone="mint"
        title="Team rules"
        description={editable ? 'Shared by everyone on the team.' : 'Shared by everyone on the team. Set by management.'}
      />

      {!editable && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-ink" data-testid="rules-readonly">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            These are set by management so ratings feel fair for everyone. If something feels off, have a chat with {managerText} 🙂
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Rating thresholds */}
        <div>
          <h3 className="text-sm font-semibold text-ink">Rating thresholds</h3>
          <p className="mt-0.5 text-xs text-muted">Time taken compared with the task's standard time.</p>
          {editable && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                  <RatingChip rating="Better" size="sm" /> up to
                </p>
                <NumberStepper
                  ariaLabel="Better threshold, percent of standard time"
                  value={draft.betterPct}
                  onChange={(v) => patch({ betterPct: v })}
                  min={50}
                  max={draft.canDoBetterPct - 5}
                  step={5}
                  suffix="%"
                />
              </div>
              <div className="rounded-2xl border border-line p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
                  <RatingChip rating="Can do better" size="sm" /> above
                </p>
                <NumberStepper
                  ariaLabel="Can do better threshold, percent of standard time"
                  value={draft.canDoBetterPct}
                  onChange={(v) => patch({ canDoBetterPct: v })}
                  min={draft.betterPct + 5}
                  max={200}
                  step={5}
                  suffix="%"
                />
              </div>
            </div>
          )}
          <div className="mt-3">
            <RatingExplainer betterPct={values.betterPct} canDoBetterPct={values.canDoBetterPct} />
          </div>
        </div>

        {/* Workday hours */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-5">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Clock3 className="h-4 w-4 text-muted" aria-hidden />
              Workday hours
            </h3>
            <p className="mt-0.5 text-xs text-muted">Sets the day progress line and the wrap-up moment.</p>
          </div>
          {editable ? (
            <NumberStepper
              ariaLabel="Workday hours"
              value={draft.workdayHours}
              onChange={(v) => patch({ workdayHours: v })}
              min={4}
              max={10}
              step={1}
              suffix="h"
            />
          ) : (
            <p className="text-lg font-bold tabular-nums text-ink" data-testid="readonly-workday">
              {values.workdayHours} hours
            </p>
          )}
        </div>

        {/* Review reminders */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-5">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <BellRing className="h-4 w-4 text-muted" aria-hidden />
              Approval reminder interval
            </h3>
            <p className="mt-0.5 text-xs text-muted">Reviewers get a gentle in-app reminder this often.</p>
          </div>
          {editable ? (
            <SegmentedControl<Interval>
              ariaLabel="Approval reminder interval"
              value={draft.approvalReminderMinutes}
              onChange={(v) => patch({ approvalReminderMinutes: v })}
              options={INTERVALS.map((m) => ({ value: m, label: `${m} min` }))}
            />
          ) : (
            <p className="text-lg font-bold tabular-nums text-ink">Every {values.approvalReminderMinutes} min</p>
          )}
        </div>
      </div>

      {editable && (
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-line/70 pt-5">
          <p className={cn('mr-auto text-xs', dirty ? 'font-semibold text-butter-ink' : 'text-muted')} aria-live="polite">
            {dirty ? 'Unsaved changes' : 'All saved ✓'}
          </p>
          <Button
            variant="ghost"
            icon={Undo2}
            disabled={isDefault}
            onClick={() => setDraft(draftFrom(DEFAULT_SETTINGS))}
          >
            Defaults
          </Button>
          <Button icon={Save} disabled={!dirty} onClick={save}>
            Save team rules
          </Button>
        </div>
      )}
    </Card>
  );
}
