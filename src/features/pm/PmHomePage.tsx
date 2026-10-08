import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function PmHomePage() {
  return (
    <Page title="Home">
      <EmptyState emoji="🏡" title="Your team view is getting ready" description="Team today, things that need you and your own tasks will appear here." />
    </Page>
  );
}
