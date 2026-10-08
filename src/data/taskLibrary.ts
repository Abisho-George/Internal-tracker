/** The predefined task library (spec §6). Changes in the app apply to new tasks only. */
import type { TaskType } from '@/store/types';

export const TASK_LIBRARY: TaskType[] = [
  { id: 'tt-prospect', name: 'Prospect searching', unit: 'prospects', unitSingular: 'prospect', standardMinutesPerUnit: 3, defaultReviewerRole: 'none', category: 'Research' },
  { id: 'tt-company-research', name: 'Company research', unit: 'companies', unitSingular: 'company', standardMinutesPerUnit: 10, defaultReviewerRole: 'none', category: 'Research', countsTowardCompanies: true },
  { id: 'tt-model', name: 'Model building', unit: 'companies', unitSingular: 'company', standardMinutesPerUnit: 20, defaultReviewerRole: 'none', category: 'Research' },
  { id: 'tt-msg-l1', name: 'First-level message', unit: 'messages', unitSingular: 'message', standardMinutesPerUnit: 3, defaultReviewerRole: 'PM', category: 'Outreach', messageLevel: 1 },
  { id: 'tt-msg-l2', name: 'Second-level message', unit: 'messages', unitSingular: 'message', standardMinutesPerUnit: 4, defaultReviewerRole: 'PM', category: 'Outreach', messageLevel: 2 },
  { id: 'tt-msg-l3', name: 'Third-level message', unit: 'messages', unitSingular: 'message', standardMinutesPerUnit: 5, defaultReviewerRole: 'PM', category: 'Outreach', messageLevel: 3 },
  { id: 'tt-telecalling', name: 'Telecalling', unit: 'calls', unitSingular: 'call', standardMinutesPerUnit: 6, defaultReviewerRole: 'none', category: 'Calling' },
  { id: 'tt-proposal', name: 'Proposal draft', unit: 'proposals', unitSingular: 'proposal', standardMinutesPerUnit: 90, defaultReviewerRole: 'Management', category: 'Content' },
  { id: 'tt-content', name: 'Content piece', unit: 'pieces', unitSingular: 'piece', standardMinutesPerUnit: 60, defaultReviewerRole: 'Management', category: 'Content' },
  { id: 'tt-client-report', name: 'Weekly client report', unit: 'reports', unitSingular: 'report', standardMinutesPerUnit: 45, defaultReviewerRole: 'PM', category: 'Reporting' },
  { id: 'tt-crm', name: 'CRM clean-up', unit: 'records', unitSingular: 'record', standardMinutesPerUnit: 2, defaultReviewerRole: 'none', category: 'Internal' },
  { id: 'tt-training', name: 'Internal training', unit: 'sessions', unitSingular: 'session', standardMinutesPerUnit: 30, defaultReviewerRole: 'none', category: 'Internal' },
];

/** Task types pre-ticked in the New project wizard ("Standard outbound" template). */
export const STANDARD_OUTBOUND_TASK_TYPE_IDS = [
  'tt-prospect',
  'tt-company-research',
  'tt-model',
  'tt-msg-l1',
  'tt-msg-l2',
  'tt-msg-l3',
  'tt-client-report',
  'tt-crm',
];

/** Sensible default quantities per task type (wizard step 3 / Plan the day). */
export const DEFAULT_TASK_QUANTITIES: Record<string, number> = {
  'tt-prospect': 25,
  'tt-company-research': 6,
  'tt-model': 3,
  'tt-msg-l1': 30,
  'tt-msg-l2': 15,
  'tt-msg-l3': 8,
  'tt-telecalling': 20,
  'tt-proposal': 1,
  'tt-content': 1,
  'tt-client-report': 1,
  'tt-crm': 20,
  'tt-training': 1,
};
