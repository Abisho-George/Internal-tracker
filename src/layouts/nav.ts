import {
  Award,
  CalendarCheck,
  ChartLine,
  ClipboardCheck,
  CloudSun,
  FolderKanban,
  House,
  LayoutDashboard,
  Library,
  Lightbulb,
  Medal,
  MessageSquareHeart,
  MessagesSquare,
  Settings,
  Sparkles,
  Star,
  Sun,
  TreePalm,
  type LucideIcon,
} from 'lucide-react';
import { matchPath } from 'react-router-dom';
import type { Role } from '@/store/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Which live count to show as a badge next to the item. */
  badge?: 'pendingReviews';
  /** Match only the exact path (for "home" items). */
  end?: boolean;
}

export const ROLE_HOME: Record<Role, string> = {
  resource: '/my-day',
  pm: '/pm',
  management: '/overview',
};

const SPOTLIGHT: NavItem = { to: '/spotlight', label: 'Spotlight', icon: Sparkles };
const SETTINGS: NavItem = { to: '/settings', label: 'Settings', icon: Settings };
const PROJECTS: NavItem = { to: '/projects', label: 'Projects', icon: FolderKanban };
const REVIEWS: NavItem = { to: '/reviews', label: 'Reviews', icon: ClipboardCheck, badge: 'pendingReviews' };

/** Sidebar navigation per role. */
export const NAV: Record<Role, NavItem[]> = {
  resource: [
    { to: '/my-day', label: 'My Day', icon: Sun },
    { to: '/my-progress', label: 'My Progress', icon: ChartLine },
    SPOTLIGHT,
    SETTINGS,
  ],
  pm: [
    { to: '/pm', label: 'Home', icon: House, end: true },
    PROJECTS,
    { to: '/plan', label: 'Plan the day', icon: CalendarCheck },
    REVIEWS,
    { to: '/library', label: 'Task library', icon: Library },
    { to: '/light-days', label: 'Light days', icon: CloudSun },
    SPOTLIGHT,
    SETTINGS,
  ],
  management: [
    { to: '/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/insights', label: 'Insights', icon: Lightbulb },
    { to: '/feedback', label: 'Weekly feedback', icon: MessageSquareHeart },
    { to: '/spotlights/manage', label: 'Pick Spotlights', icon: Star },
    { to: '/recognition', label: 'Recognition', icon: Award },
    PROJECTS,
    REVIEWS,
    SPOTLIGHT,
    SETTINGS,
  ],
};

/** Greyed-out, non-clickable sidebar items (spec §7). */
export const COMING_SOON_ITEMS: { label: string; icon: LucideIcon }[] = [
  { label: 'Leave', icon: TreePalm },
  { label: 'Appraisals', icon: Medal },
  { label: 'Team Chat (replaces WhatsApp)', icon: MessagesSquare },
];

/** Route patterns each role may open (mirrors the route table in ARCHITECTURE.md). */
export const ALLOWED_ROUTES: Record<Role, string[]> = {
  resource: ['/my-day', '/my-progress', '/spotlight', '/settings'],
  pm: [
    '/pm',
    '/projects',
    '/projects/new',
    '/projects/:projectId',
    '/plan',
    '/reviews',
    '/library',
    '/light-days',
    '/spotlight',
    '/settings',
  ],
  management: [
    '/overview',
    '/insights',
    '/feedback',
    '/feedback/:personId',
    '/spotlights/manage',
    '/recognition',
    '/projects',
    '/projects/new',
    '/projects/:projectId',
    '/reviews',
    '/library',
    '/light-days',
    '/spotlight',
    '/settings',
  ],
};

/** True when `pathname` matches one of the role's allowed route patterns. */
export function isPathAllowed(role: Role, pathname: string): boolean {
  return ALLOWED_ROUTES[role].some((pattern) => matchPath({ path: pattern, end: true }, pathname) !== null);
}

/** Display names for the "Viewing as" groups, in display order. */
export const ROLE_GROUPS: { role: Role; label: string }[] = [
  { role: 'resource', label: 'Resources' },
  { role: 'pm', label: 'Project Managers' },
  { role: 'management', label: 'Management' },
];
