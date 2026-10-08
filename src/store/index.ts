/** Store barrel: `import { useApp, useNow, rateTask, ... } from '@/store'`. */
export * from './types';
export { useApp, DEFAULT_USER_PREFS, STORAGE_KEY, pickData } from './useApp';
export * from './hooks';
export * from './time';
export * from './rating';
export * from './metrics';
export * from './suggestions';
export * from './automations';

// Seed-level constants & helpers that screens may need.
export { buildSeed, DEFAULT_SETTINGS, DATA_VERSION } from '@/data/seed';
export { DEFAULT_MANAGEMENT_REVIEWER_ID, DEFAULT_CURRENT_USER_ID } from '@/data/people';
export { randomAlias, ALIAS_ADJECTIVES, ALIAS_ANIMALS } from '@/data/chat';
export { STANDARD_OUTBOUND_TARGETS } from '@/data/projects';
export { STANDARD_OUTBOUND_TASK_TYPE_IDS, DEFAULT_TASK_QUANTITIES } from '@/data/taskLibrary';
