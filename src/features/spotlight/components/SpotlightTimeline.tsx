import { motion, useReducedMotion } from 'framer-motion';
import { Compass, Rocket, Star } from 'lucide-react';
import { personById, projectById } from '@/store';
import type { Person, Project, Spotlight } from '@/store/types';
import { Avatar, Chip, TONE_STRONG_BG, cn } from '@/components';
import { monthLabel } from '../spotlightStats';

export interface SpotlightTimelineProps {
  spotlights: Spotlight[];
  people: Person[];
  projects: Project[];
}

/** Past months, newest first: month label + the three winners as chips. */
export function SpotlightTimeline({ spotlights, people, projects }: SpotlightTimelineProps) {
  const reduce = useReducedMotion();
  return (
    <ol className="relative space-y-4 pl-6" data-testid="spotlight-timeline">
      <span aria-hidden className="absolute bottom-3 left-[7px] top-3 w-0.5 rounded-full bg-line" />
      {spotlights.map((s, i) => {
        const person = personById(people, s.personId);
        const pm = personById(people, s.pmId);
        const project = projectById(projects, s.projectId);
        return (
          <motion.li
            key={s.id}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.25 + i * 0.06 }}
            className="relative"
          >
            <span
              aria-hidden
              className={cn(
                'absolute -left-6 top-4 h-4 w-4 rounded-full ring-4 ring-bg',
                i === 0 ? TONE_STRONG_BG.lavender : TONE_STRONG_BG.grey,
              )}
            />
            <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-5">
              <h3 className="w-36 shrink-0 text-sm font-bold text-ink">{monthLabel(s.month)}</h3>
              <ul className="flex min-w-0 flex-wrap gap-2" aria-label={`${monthLabel(s.month)} Spotlights`}>
                <li>
                  <Chip tone="mint" icon={Star} className="pr-3">
                    <span className="sr-only">Spotlight Person: </span>
                    {person && <Avatar person={person} size="xs" decorative className="-my-1 mr-0.5" />}
                    {person?.name ?? 'Someone lovely'}
                  </Chip>
                </li>
                <li>
                  <Chip tone="sky" icon={Compass} className="pr-3">
                    <span className="sr-only">Spotlight PM: </span>
                    {pm && <Avatar person={pm} size="xs" decorative className="-my-1 mr-0.5" />}
                    {pm?.name ?? 'A wonderful PM'}
                  </Chip>
                </li>
                <li className="min-w-0 max-w-full">
                  <Chip tone="peach" icon={Rocket} className="max-w-full pr-3">
                    <span className="sr-only">Spotlight Project: </span>
                    <span className="truncate">{project?.name ?? 'A great project'}</span>
                  </Chip>
                </li>
              </ul>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
