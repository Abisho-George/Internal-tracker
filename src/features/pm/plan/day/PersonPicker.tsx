import { Avatar, cn } from '@/components';
import { formatMinutes, type Person } from '@/store';

export interface PersonPickerProps {
  people: Person[];
  selectedId: string | undefined;
  /** Saved planned minutes per person on the selected date. */
  plannedByPerson: Record<string, number>;
  onSelect: (personId: string) => void;
}

/** Avatar row of the team (alphabetical). Shows how much is already planned for each. */
export function PersonPicker({ people, selectedId, plannedByPerson, onSelect }: PersonPickerProps) {
  return (
    <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 scrollbar-none" aria-label="Team">
      {people.map((p) => {
        const selected = p.id === selectedId;
        const planned = plannedByPerson[p.id] ?? 0;
        return (
          <li key={p.id} className="shrink-0">
            <button
              type="button"
              aria-pressed={selected}
              data-person={p.firstName}
              onClick={() => onSelect(p.id)}
              className={cn(
                'focus-ring flex w-[104px] flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-center transition duration-150 active:scale-[0.98]',
                selected
                  ? 'border-accent/50 bg-accent-soft shadow-soft'
                  : 'border-line/70 bg-surface hover:border-faint/50 hover:bg-surface-2/60',
              )}
            >
              <Avatar person={p} size="md" decorative className={cn(selected && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')} />
              <span className={cn('w-full truncate text-sm font-semibold', selected ? 'text-accent-ink' : 'text-ink')}>{p.firstName}</span>
              <span className={cn('w-full truncate text-[11px]', selected ? 'text-accent-ink' : 'text-muted')}>
                {planned > 0 ? `${formatMinutes(planned)} planned` : 'Nothing yet'}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
