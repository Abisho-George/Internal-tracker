import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function MyProgressPage() {
  return (
    <Page title="My Progress">
      <EmptyState emoji="📈" title="Your progress story is on its way" description="Weekly trends compared with your own history will appear here." />
    </Page>
  );
}
