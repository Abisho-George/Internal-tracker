import { Page } from '@/components';
import { DemoControlsCard } from './components/DemoControlsCard';
import { PreferencesCard } from './components/PreferencesCard';
import { TeamRulesCard } from './components/TeamRulesCard';

/** Settings (everyone): personal preferences, demo controls and the team's rules. */
export default function SettingsPage() {
  return (
    <Page title="Settings" subtitle="Make LS Tracker feel like yours, and run the demo your way.">
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <PreferencesCard />
          <DemoControlsCard />
        </div>
        <div className="min-w-0">
          <TeamRulesCard />
        </div>
      </div>
    </Page>
  );
}
