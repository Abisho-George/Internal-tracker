import type { Project } from '@/store/types';
import { Chip, type ChipSize } from './Chip';
import { cn } from './cn';
import { TONE_STRONG_BG } from './tones';

export interface ProjectChipProps {
  project: Project;
  size?: ChipSize;
  /** Show the client name instead of the full project name (compact spots). */
  short?: boolean;
  className?: string;
}

/** Project name on its pastel colour, with a small dot. Full name in the title tooltip. */
export function ProjectChip({ project, size = 'sm', short = false, className }: ProjectChipProps) {
  return (
    <Chip
      tone={project.color}
      size={size}
      title={project.name}
      className={cn('min-w-0', className)}
      icon={<span className={cn('h-1.5 w-1.5 rounded-full', TONE_STRONG_BG[project.color])} />}
    >
      <span className="truncate">{short ? project.client : project.name}</span>
    </Chip>
  );
}
