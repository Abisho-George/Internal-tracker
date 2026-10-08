import { Navigate, Outlet, createBrowserRouter, createHashRouter, useLocation, type RouteObject } from 'react-router-dom';
import { useCurrentUser } from '@/store';
import { AppShell } from '@/layouts/AppShell';
import { RouteError } from '@/layouts/RouteError';
import { ROLE_HOME, isPathAllowed } from '@/layouts/nav';

// Resource
import MyDayPage from '@/features/resource/MyDayPage';
import MyProgressPage from '@/features/resource/MyProgressPage';
// Project manager
import PmHomePage from '@/features/pm/PmHomePage';
import ProjectsPage from '@/features/pm/ProjectsPage';
import NewProjectWizard from '@/features/pm/NewProjectWizard';
import ProjectDetailPage from '@/features/pm/ProjectDetailPage';
import PlanDayPage from '@/features/pm/PlanDayPage';
import ReviewsPage from '@/features/pm/ReviewsPage';
import TaskLibraryPage from '@/features/pm/TaskLibraryPage';
import LightDaysPage from '@/features/pm/LightDaysPage';
// Management
import OverviewPage from '@/features/management/OverviewPage';
import InsightsPage from '@/features/management/InsightsPage';
import FeedbackListPage from '@/features/management/FeedbackListPage';
import FeedbackEditorPage from '@/features/management/FeedbackEditorPage';
import ManageSpotlightsPage from '@/features/management/ManageSpotlightsPage';
import RecognitionPage from '@/features/management/RecognitionPage';
// Shared
import SpotlightPage from '@/features/spotlight/SpotlightPage';
import SettingsPage from '@/features/settings/SettingsPage';

/** Sends the viewer to their role's home page. */
export function HomeRedirect() {
  const me = useCurrentUser();
  return <Navigate to={ROLE_HOME[me.role]} replace />;
}

/** Redirects to the viewer's home when the current path isn't allowed for their role. */
export function RoleGuard() {
  const me = useCurrentUser();
  const { pathname } = useLocation();
  if (!isPathAllowed(me.role, pathname)) return <Navigate to={ROLE_HOME[me.role]} replace />;
  return <Outlet />;
}

/** Route table — keep in sync with docs/ARCHITECTURE.md → Routes and layouts/nav.ts → ALLOWED_ROUTES. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomeRedirect /> },
      {
        element: <RoleGuard />,
        errorElement: <RouteError />,
        children: [
          { path: 'my-day', element: <MyDayPage /> },
          { path: 'my-progress', element: <MyProgressPage /> },

          { path: 'pm', element: <PmHomePage /> },
          { path: 'projects', element: <ProjectsPage /> },
          { path: 'projects/new', element: <NewProjectWizard /> },
          { path: 'projects/:projectId', element: <ProjectDetailPage /> },
          { path: 'plan', element: <PlanDayPage /> },
          { path: 'reviews', element: <ReviewsPage /> },
          { path: 'library', element: <TaskLibraryPage /> },
          { path: 'light-days', element: <LightDaysPage /> },

          { path: 'overview', element: <OverviewPage /> },
          { path: 'insights', element: <InsightsPage /> },
          { path: 'feedback', element: <FeedbackListPage /> },
          { path: 'feedback/:personId', element: <FeedbackEditorPage /> },
          { path: 'spotlights/manage', element: <ManageSpotlightsPage /> },
          { path: 'recognition', element: <RecognitionPage /> },

          { path: 'spotlight', element: <SpotlightPage /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      { path: '*', element: <HomeRedirect /> },
    ],
  },
];

export const router = (import.meta.env.VITE_HASH_ROUTER ? createHashRouter : createBrowserRouter)(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
