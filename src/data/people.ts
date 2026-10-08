/**
 * THE one place for every dummy name in the prototype (spec §4).
 * Swap these placeholders for real people without touching anything else.
 */
import type { Person } from '@/store/types';

/** Who receives "Management" reviews (proposals, content pieces) by default. */
export const DEFAULT_MANAGEMENT_REVIEWER_ID = 'p-kabir';

/** The person the demo opens as. */
export const DEFAULT_CURRENT_USER_ID = 'p-asha';

export const PEOPLE: Person[] = [
  // Resources (mint) — managerId is their primary PM.
  { id: 'p-asha', name: 'Asha Rao', firstName: 'Asha', role: 'resource', title: 'Outreach Specialist', avatarColor: 'mint', managerId: 'p-meera' },
  { id: 'p-rohan', name: 'Rohan Mehta', firstName: 'Rohan', role: 'resource', title: 'Outreach Specialist', avatarColor: 'mint', managerId: 'p-meera' },
  { id: 'p-neha', name: 'Neha Iyer', firstName: 'Neha', role: 'resource', title: 'Content & Outreach Specialist', avatarColor: 'mint', managerId: 'p-meera' },
  { id: 'p-vikram', name: 'Vikram Shetty', firstName: 'Vikram', role: 'resource', title: 'Research Specialist', avatarColor: 'mint', managerId: 'p-meera' },
  { id: 'p-priya', name: 'Priya Nair', firstName: 'Priya', role: 'resource', title: 'Senior Outreach Specialist', avatarColor: 'mint', managerId: 'p-arjun' },
  { id: 'p-karan', name: 'Karan Desai', firstName: 'Karan', role: 'resource', title: 'Outreach Specialist', avatarColor: 'mint', managerId: 'p-arjun' },
  // Project managers (sky)
  { id: 'p-meera', name: 'Meera Kulkarni', firstName: 'Meera', role: 'pm', title: 'Project Manager', avatarColor: 'sky', managerId: 'p-anika' },
  { id: 'p-arjun', name: 'Arjun Pillai', firstName: 'Arjun', role: 'pm', title: 'Project Manager', avatarColor: 'sky', managerId: 'p-anika' },
  // Management (peach)
  { id: 'p-kabir', name: 'Kabir Sen', firstName: 'Kabir', role: 'management', title: 'Director', avatarColor: 'peach' },
  { id: 'p-anika', name: 'Anika Bose', firstName: 'Anika', role: 'management', title: 'Head of Delivery', avatarColor: 'peach', managerId: 'p-kabir' },
];

/** Resource ids in the order the seed generates them (not a ranking). */
export const RESOURCE_IDS = PEOPLE.filter((p) => p.role === 'resource').map((p) => p.id);
