import { CircleCheck, CirclePause, CirclePlay, Globe, Sprout } from 'lucide-react';
import { Chip } from '@/components';
import type { Geography, ProjectStatus } from '@/store';

const STATUS = {
  active: { tone: 'mint', icon: CirclePlay, label: 'Active' },
  paused: { tone: 'butter', icon: CirclePause, label: 'Paused' },
  done: { tone: 'grey', icon: CircleCheck, label: 'Wrapped up' },
} as const;

/** "Active" / "Paused" / "Wrapped up". */
export function CoreProjectStatusChip({ status }: { status: ProjectStatus }) {
  const s = STATUS[status];
  return (
    <Chip tone={s.tone} size="sm" icon={s.icon}>
      {s.label}
    </Chip>
  );
}

/** Geography chip ("US", "APAC"...). */
export function CoreGeoChip({ geography }: { geography: Geography }) {
  return (
    <Chip tone="sky" size="sm" icon={Globe}>
      <span className="sr-only">Geography: </span>
      {geography}
    </Chip>
  );
}

/** Shown while a project has no work logged yet, so a 0% ring reads as "fresh", not "stuck". */
export function CoreJustStartedChip() {
  return (
    <Chip tone="lavender" size="sm" icon={Sprout}>
      Just started
    </Chip>
  );
}
