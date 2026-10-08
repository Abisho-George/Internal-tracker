import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function MyDayPage() {
  return (
    <Page title="My Day">
      <EmptyState emoji="☀️" title="Your day is warming up" description="Today's tasks and your progress line will appear here." />
    </Page>
  );
}
