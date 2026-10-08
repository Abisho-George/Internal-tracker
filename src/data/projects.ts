/** The three active demo projects. Achievement numbers are filled in by the seed. */
import type { Geography, PastelKey, Project, ProjectTargets } from '@/store/types';
import { DEFAULT_TASK_QUANTITIES } from './taskLibrary';

/** "Standard outbound" template used to prefill the New project wizard targets. */
export const STANDARD_OUTBOUND_TARGETS: ProjectTargets = {
  companies: 100,
  weeklyMessagesL1: 300,
  weeklyMessagesL2: 150,
  weeklyMessagesL3: 75,
  meetingsTarget: 12,
};

export interface ProjectDef {
  id: string;
  name: string;
  client: string;
  geography: Geography;
  pmId: string;
  resourceIds: string[];
  /** Weeks between the project start and the Monday of the demo week. */
  startWeeksAgo: number;
  targets: ProjectTargets;
  taskTypeIds: string[];
  color: PastelKey;
  /** Resource who writes the weekly client report. */
  reportOwnerId: string;
}

export const PROJECT_DEFS: ProjectDef[] = [
  {
    id: 'pr-northwind',
    name: 'Northwind SaaS – US Outbound',
    client: 'Northwind',
    geography: 'US',
    pmId: 'p-meera',
    resourceIds: ['p-asha', 'p-rohan', 'p-neha'],
    startWeeksAgo: 10,
    targets: { companies: 100, weeklyMessagesL1: 300, weeklyMessagesL2: 150, weeklyMessagesL3: 75, meetingsTarget: 12 },
    taskTypeIds: ['tt-prospect', 'tt-company-research', 'tt-model', 'tt-msg-l1', 'tt-msg-l2', 'tt-msg-l3', 'tt-telecalling', 'tt-content', 'tt-proposal', 'tt-client-report', 'tt-crm', 'tt-training'],
    color: 'sky',
    reportOwnerId: 'p-rohan',
  },
  {
    id: 'pr-helios',
    name: 'Helios Fintech – UK ABM',
    client: 'Helios',
    geography: 'UK',
    pmId: 'p-arjun',
    resourceIds: ['p-priya', 'p-karan', 'p-neha'],
    startWeeksAgo: 9,
    targets: { companies: 80, weeklyMessagesL1: 250, weeklyMessagesL2: 125, weeklyMessagesL3: 60, meetingsTarget: 10 },
    taskTypeIds: ['tt-prospect', 'tt-company-research', 'tt-model', 'tt-msg-l1', 'tt-msg-l2', 'tt-msg-l3', 'tt-telecalling', 'tt-proposal', 'tt-content', 'tt-client-report', 'tt-crm', 'tt-training'],
    color: 'peach',
    reportOwnerId: 'p-priya',
  },
  {
    id: 'pr-atlas',
    name: 'Atlas Health – APAC Pipeline',
    client: 'Atlas Health',
    geography: 'APAC',
    pmId: 'p-meera',
    resourceIds: ['p-vikram', 'p-asha', 'p-karan'],
    startWeeksAgo: 9,
    targets: { companies: 120, weeklyMessagesL1: 280, weeklyMessagesL2: 140, weeklyMessagesL3: 70, meetingsTarget: 14 },
    taskTypeIds: ['tt-prospect', 'tt-company-research', 'tt-model', 'tt-msg-l1', 'tt-msg-l2', 'tt-msg-l3', 'tt-telecalling', 'tt-content', 'tt-proposal', 'tt-client-report', 'tt-crm', 'tt-training'],
    color: 'mint',
    reportOwnerId: 'p-vikram',
  },
];

const ZERO_TARGETS: ProjectTargets = {
  companies: 0,
  weeklyMessagesL1: 0,
  weeklyMessagesL2: 0,
  weeklyMessagesL3: 0,
  meetingsTarget: 0,
};

/**
 * Base project records. `startDate` is derived from the Monday of the demo week;
 * `achieved`, `meetingsBooked` and `meetingsByWeek` are filled in by the seed.
 */
export function buildBaseProjects(startDateFor: (weeksAgo: number) => string): Project[] {
  return PROJECT_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    client: def.client,
    geography: def.geography,
    pmId: def.pmId,
    resourceIds: [...def.resourceIds],
    startDate: startDateFor(def.startWeeksAgo),
    status: 'active',
    targets: { ...def.targets },
    achieved: { ...ZERO_TARGETS },
    meetingsBooked: 0,
    meetingsByWeek: {},
    taskTypeIds: [...def.taskTypeIds],
    defaultQuantities: Object.fromEntries(def.taskTypeIds.map((id) => [id, DEFAULT_TASK_QUANTITIES[id] ?? 1])),
    color: def.color,
  }));
}
