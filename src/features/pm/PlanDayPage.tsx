import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function PlanDayPage() {
  return (
    <Page title="Plan the day">
      <EmptyState emoji="🗓️" title="Planning is coming together" description="Pick a person and a date to build their day plan here." />
    </Page>
  );
}
