import type { Person } from '@/store/types';
import { cn } from './cn';
import { initialsOf } from './format';
import { TONE_SOFT_BG } from './tones';
import { Tooltip } from './Tooltip';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  person: Pick<Person, 'name' | 'avatarColor'> & Partial<Pick<Person, 'id'>>;
  size?: AvatarSize;
  /** Show the person's name in a tooltip on hover/focus. */
  showTooltip?: boolean;
  className?: string;
  /** Adds a ring in the page colour (used when stacking avatars). */
  ring?: boolean;
  /** Hide from screen readers when the name is already shown next to it. */
  decorative?: boolean;
}

const SIZE: Record<AvatarSize, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl',
};

/** Initials on the person's role colour (soft fill, ink text). */
export function Avatar({
  person,
  size = 'md',
  showTooltip = false,
  className,
  ring = false,
  decorative = false,
}: AvatarProps) {
  const avatar = (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : person.name}
      aria-hidden={decorative || undefined}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold tracking-tight text-ink',
        TONE_SOFT_BG[person.avatarColor],
        SIZE[size],
        ring && 'ring-2 ring-surface',
        className,
      )}
    >
      <span aria-hidden>{initialsOf(person.name)}</span>
    </span>
  );
  if (!showTooltip) return avatar;
  return (
    <Tooltip content={person.name} describe={false}>
      {avatar}
    </Tooltip>
  );
}

export interface AvatarStackProps {
  people: Person[];
  /** How many avatars to show before "+N". Default 4. */
  max?: number;
  size?: AvatarSize;
  className?: string;
}

const OVERLAP: Record<AvatarSize, string> = {
  xs: '-space-x-1',
  sm: '-space-x-1.5',
  md: '-space-x-2',
  lg: '-space-x-2.5',
  xl: '-space-x-3',
};

/** Overlapping avatars with a "+N" chip; every avatar has a name tooltip. */
export function AvatarStack({ people, max = 4, size = 'sm', className }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <div
      role="group"
      aria-label={people.map((p) => p.name).join(', ')}
      className={cn('flex items-center', OVERLAP[size], className)}
    >
      {shown.map((p) => (
        <Avatar key={p.id} person={p} size={size} ring showTooltip />
      ))}
      {extra > 0 && (
        <span
          aria-hidden
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-muted ring-2 ring-surface',
            SIZE[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
