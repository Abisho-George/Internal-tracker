import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function FeedbackListPage() {
  return (
    <Page title="Weekly feedback">
      <EmptyState emoji="💌" title="Weekly feedback is on its way" description="This week's reports for each person will appear here." />
    </Page>
  );
}
