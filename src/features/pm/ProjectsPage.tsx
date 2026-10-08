import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function ProjectsPage() {
  return (
    <Page title="Projects">
      <EmptyState emoji="🗂️" title="Projects are lining up" description="Project cards with health and weekly message counts will appear here." />
    </Page>
  );
}
