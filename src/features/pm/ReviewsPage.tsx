import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function ReviewsPage() {
  return (
    <Page title="Reviews">
      <EmptyState emoji="✅" title="All caught up ☀️" description="Review tasks assigned to you will appear here." />
    </Page>
  );
}
