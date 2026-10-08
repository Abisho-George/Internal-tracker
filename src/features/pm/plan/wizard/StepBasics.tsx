import { useId, type RefObject } from 'react';
import { Wand2 } from 'lucide-react';
import { Field, TextInput } from '@/components';
import type { Geography } from '@/store';
import { PillRadio } from '../PillRadio';
import { GEOGRAPHIES, longDate } from '../planShared';
import { suggestedName, type WizardDraft, type WizardUpdate } from './wizardModel';

export interface StepBasicsProps {
  draft: WizardDraft;
  update: WizardUpdate;
  showHints: boolean;
  nameRef: RefObject<HTMLInputElement>;
  clientRef: RefObject<HTMLInputElement>;
}

const GEO_EMOJI: Record<Geography, string> = { US: '🇺🇸', UK: '🇬🇧', EU: '🇪🇺', APAC: '🌏', India: '🇮🇳' };

export function StepBasics({ draft, update, showHints, nameRef, clientRef }: StepBasicsProps) {
  const geoLabel = useId();
  const suggestion = suggestedName(draft.client, draft.geography, draft.template);
  const nameMissing = showHints && !draft.name.trim();
  const clientMissing = showHints && !draft.client.trim();

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field
        label="Project name"
        hint={
          nameMissing ? (
            <span className="font-semibold text-butter-ink">Give it a name to keep going ✏️</span>
          ) : suggestion && !draft.name.trim() ? undefined : (
            'What the team will see on every task.'
          )
        }
      >
        <TextInput
          ref={nameRef}
          autoFocus
          value={draft.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="e.g. Orbit Labs – US Outbound"
          autoComplete="off"
          invalid={nameMissing}
          aria-required
          maxLength={80}
        />
      </Field>

      <Field
        label="Client"
        hint={clientMissing ? <span className="font-semibold text-butter-ink">Who is this for? ✏️</span> : 'The company we are doing this for.'}
      >
        <TextInput
          ref={clientRef}
          value={draft.client}
          onChange={(e) => update({ client: e.target.value })}
          placeholder="e.g. Orbit Labs"
          autoComplete="off"
          invalid={clientMissing}
          aria-required
          maxLength={60}
        />
      </Field>

      {suggestion && !draft.name.trim() && (
        <div className="-mt-2 md:col-span-2">
          <button
            type="button"
            onClick={() => update({ name: suggestion })}
            className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-lavender-soft px-3 py-1.5 text-xs font-semibold text-lavender-ink transition hover:brightness-[0.97] dark:hover:brightness-125"
          >
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            Use “{suggestion}” as the name
          </button>
        </div>
      )}

      <div className="flex flex-col gap-1.5 md:col-span-2">
        <span id={geoLabel} className="text-sm font-semibold text-ink">
          Geography
        </span>
        <PillRadio<Geography>
          labelledBy={geoLabel}
          size="md"
          showCheck
          value={draft.geography}
          onChange={(geography) => update({ geography })}
          options={GEOGRAPHIES.map((g) => ({ value: g, label: <><span aria-hidden>{GEO_EMOJI[g]}</span> {g}</>, ariaLabel: g }))}
        />
      </div>

      <Field
        label="Start date"
        hint={draft.startDate ? `Kicks off ${longDate(draft.startDate)}.` : <span className="font-semibold text-butter-ink">Pick a start date.</span>}
      >
        <TextInput
          type="date"
          value={draft.startDate}
          onChange={(e) => update({ startDate: e.target.value })}
          className="max-w-[220px]"
        />
      </Field>
    </div>
  );
}
