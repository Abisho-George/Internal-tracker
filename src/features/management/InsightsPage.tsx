import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function InsightsPage() {
  return (
    <Page title="Insights">
      <EmptyState emoji="💡" title="Insights are brewing" description="Trends by project, person and PM will appear here." />
    </Page>
  );
}
