import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function OverviewPage() {
  return (
    <Page title="Overview">
      <EmptyState emoji="🧭" title="Today's overview is warming up" description="Team KPIs, project health and reviews waiting on you will appear here." />
    </Page>
  );
}
