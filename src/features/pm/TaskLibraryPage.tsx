import { EmptyState, Page } from '@/components';

/** Placeholder — the feature build replaces this page. */
export default function TaskLibraryPage() {
  return (
    <Page title="Task library">
      <EmptyState emoji="📚" title="The task library is on its way" description="Predefined task types with standard times will appear here." />
    </Page>
  );
}
