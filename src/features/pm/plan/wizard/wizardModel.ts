import {
  DEFAULT_TASK_QUANTITIES,
  STANDARD_OUTBOUND_TARGETS,
  STANDARD_OUTBOUND_TASK_TYPE_IDS,
  type Geography,
  type ProjectTargets,
  type TaskType,
} from '@/store';
import { LIGHT_ABM_TARGETS } from '../planShared';

export type TemplateKey = 'standard' | 'abm';

export interface TemplateDef {
  key: TemplateKey;
  label: string;
  emoji: string;
  description: string;
  targets: ProjectTargets;
}

export const TEMPLATES: TemplateDef[] = [
  {
    key: 'standard',
    label: 'Standard outbound',
    emoji: '🚀',
    description: '100 companies, a full L1 → L3 sequence and 12 meetings.',
    targets: STANDARD_OUTBOUND_TARGETS,
  },
  {
    key: 'abm',
    label: 'Light ABM',
    emoji: '🎯',
    description: 'A smaller, focused account list with lighter weekly volumes.',
    targets: LIGHT_ABM_TARGETS,
  },
];

export interface WizardTaskPick {
  on: boolean;
  qty: number;
}

export interface WizardDraft {
  name: string;
  client: string;
  geography: Geography;
  startDate: string;
  template: TemplateKey;
  targets: ProjectTargets;
  /** Every non-archived task type, ticked or not, with its default quantity. */
  tasks: Record<string, WizardTaskPick>;
  resourceIds: string[];
  pmId: string;
}

export type WizardUpdate = (patch: Partial<WizardDraft>) => void;

export function initialTaskPicks(taskTypes: TaskType[]): Record<string, WizardTaskPick> {
  return Object.fromEntries(
    taskTypes
      .filter((t) => !t.archived)
      .map((t) => [t.id, { on: STANDARD_OUTBOUND_TASK_TYPE_IDS.includes(t.id), qty: DEFAULT_TASK_QUANTITIES[t.id] ?? 1 }]),
  );
}

export function sameTargets(a: ProjectTargets, b: ProjectTargets): boolean {
  return (
    a.companies === b.companies &&
    a.weeklyMessagesL1 === b.weeklyMessagesL1 &&
    a.weeklyMessagesL2 === b.weeklyMessagesL2 &&
    a.weeklyMessagesL3 === b.weeklyMessagesL3 &&
    a.meetingsTarget === b.meetingsTarget
  );
}

export function suggestedName(client: string, geography: Geography, template: TemplateKey): string {
  const c = client.trim();
  if (!c) return '';
  return `${c} – ${geography} ${template === 'abm' ? 'ABM' : 'Outbound'}`;
}

export interface TargetField {
  key: keyof ProjectTargets;
  label: string;
  hint: string;
  step: number;
  max: number;
  emoji: string;
}

export const TARGET_FIELDS: TargetField[] = [
  { key: 'companies', label: 'Companies', hint: 'For the whole engagement', step: 10, max: 5000, emoji: '🏢' },
  { key: 'weeklyMessagesL1', label: 'L1 messages', hint: 'First-level, per week', step: 25, max: 5000, emoji: '✉️' },
  { key: 'weeklyMessagesL2', label: 'L2 messages', hint: 'Second-level, per week', step: 10, max: 5000, emoji: '💬' },
  { key: 'weeklyMessagesL3', label: 'L3 messages', hint: 'Third-level, per week', step: 5, max: 5000, emoji: '📨' },
  { key: 'meetingsTarget', label: 'Meetings', hint: 'For the whole engagement', step: 1, max: 500, emoji: '🤝' },
];
