import { useId, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Lightbulb } from 'lucide-react';
import type { Suggestion } from '@/store';
import { Card, Chip, Field, PillToggle, TONE_SOFT, TextArea, cn } from '@/components';
import { SPOTLIGHT_KIND, type SpotlightKind } from './SpotlightCard';

export interface PickerOption {
  id: string;
  label: string;
  detail?: string;
  visual: ReactNode;
}

export interface SpotlightPickerProps {
  kind: SpotlightKind;
  description: string;
  suggestions: Suggestion[];
  /** Every eligible choice, alphabetical. */
  options: PickerOption[];
  value: string | null;
  onChange: (id: string) => void;
  citation: string;
  onCitationChange: (text: string) => void;
  citationPlaceholder: string;
}

export const CITATION_MAX = 240;

/** One Spotlight picker: suggestion cards with a short reason, "Someone else" pills and a citation. */
export function SpotlightPicker({
  kind,
  description,
  suggestions,
  options,
  value,
  onChange,
  citation,
  onCitationChange,
  citationPlaceholder,
}: SpotlightPickerProps) {
  const reduce = useReducedMotion();
  const meta = SPOTLIGHT_KIND[kind];
  const Icon = meta.icon;
  const headingId = useId();
  const othersId = useId();
  const suggestedIds = new Set(suggestions.map((s) => s.id));
  const others = options.filter((o) => !suggestedIds.has(o.id));
  const [showOthers, setShowOthers] = useState(() => !!value && !suggestedIds.has(value));
  const selected = options.find((o) => o.id === value);

  return (
    <Card as="section" aria-labelledby={headingId} className="p-5 sm:p-6" data-testid={`picker-${kind}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONE_SOFT[meta.tone])}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-bold leading-snug">
              {meta.label}
            </h2>
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          </div>
        </div>
        {selected ? (
          <Chip tone={meta.tone} icon={Check} data-testid={`picked-${kind}`}>
            {selected.label}
          </Chip>
        ) : (
          <Chip tone="grey">Not picked yet</Chip>
        )}
      </div>

      <div
        role="group"
        aria-label={`Suggestions for ${meta.label}`}
        className={cn('grid gap-3 sm:grid-cols-2', suggestions.length >= 3 && 'xl:grid-cols-3')}
      >
        {suggestions.map((s) => {
          const option = options.find((o) => o.id === s.id);
          if (!option) return null;
          const isSelected = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(s.id)}
              data-suggestion={s.id}
              className={cn(
                'focus-ring group relative flex h-full flex-col gap-3 rounded-2xl border p-4 text-left transition duration-150',
                isSelected
                  ? 'border-accent bg-accent-soft/60 shadow-soft ring-1 ring-accent'
                  : 'border-line bg-surface hover:-translate-y-0.5 hover:border-faint/50 hover:shadow-soft motion-reduce:hover:translate-y-0',
              )}
            >
              <span className="flex min-w-0 items-start gap-3 pr-7">
                {option.visual}
                <span className="min-w-0">
                  <span className="block break-words font-semibold leading-snug text-ink">{option.label}</span>
                  {option.detail && <span className="block truncate text-xs text-muted">{option.detail}</span>}
                </span>
              </span>
              <span className="flex items-start gap-1.5 text-sm leading-snug text-muted">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                <span>{s.reason}</span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'absolute right-3 top-3 inline-flex h-6 w-6 items-center justify-center rounded-full border transition',
                  isSelected ? 'border-accent bg-accent text-accent-on' : 'border-line bg-surface text-transparent',
                )}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>

      {others.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={showOthers}
            aria-controls={othersId}
            onClick={() => setShowOthers((v) => !v)}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-accent-ink hover:underline"
          >
            Someone else
            <ChevronDown className={cn('h-4 w-4 transition', showOthers && 'rotate-180')} aria-hidden />
          </button>
          <AnimatePresence initial={false}>
            {showOthers && (
              <motion.div
                id={othersId}
                initial={reduce ? false : { height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div role="group" aria-label={`Everyone else for ${meta.label}`} className="flex flex-wrap gap-2 px-0.5 pb-1 pt-2">
                  {others.map((o) => (
                    <PillToggle key={o.id} size="sm" pressed={value === o.id} showCheck onChange={() => onChange(o.id)}>
                      {o.label}
                    </PillToggle>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <Field
        className="mt-5"
        label="Citation"
        optional
        hint={
          <span className="flex justify-between gap-3">
            <span>A sentence or two everyone will see on the Spotlight page.</span>
            <span className="shrink-0 tabular-nums">
              {citation.length}/{CITATION_MAX}
            </span>
          </span>
        }
      >
        <TextArea
          rows={2}
          value={citation}
          maxLength={CITATION_MAX}
          placeholder={citationPlaceholder}
          onChange={(e) => onCitationChange(e.target.value)}
        />
      </Field>
    </Card>
  );
}
