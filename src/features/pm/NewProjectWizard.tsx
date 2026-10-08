import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function NewProjectWizard() {
  return (
    <Page title="New project">
      <EmptyState emoji="✨" title="The project wizard is almost here" description="Set up a project in about 3 minutes, right here." />
    </Page>
  );
}
