import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function ManageSpotlightsPage() {
  return (
    <Page title="Pick Spotlights">
      <EmptyState emoji="🌟" title="Spotlight picks are coming together" description="Choose this month's Spotlight Person, PM and Project here." />
    </Page>
  );
}
