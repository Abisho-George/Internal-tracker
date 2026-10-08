import { useId, useState } from 'react';
import { format } from 'date-fns';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck, ChevronDown } from 'lucide-react';
import { effectiveStandard, formatMinutes, parseDate, plannedMinutes } from '@/store';
import type { Project, Task } from '@/store/types';
import { PriorityBadge, ProjectChip, cn } from '@/components';
import { TIME_BLOCKS, TIME_BLOCK_SHORT } from './helpers';

export interface TomorrowPeekProps {
  date: string;
  tasks: Task[];
  projects: Project[];
}

/** Read-only, collapsible peek at the next working day's plan. */
export function TomorrowPeek({ date, tasks, projects }: TomorrowPeekProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const ordered = [...tasks].sort((a, b) => TIME_BLOCKS.indexOf(a.timeBlock) - TIME_BLOCKS.indexOf(b.timeBlock));
  const total = plannedMinutes(tasks);

  return (
    <section className="card overflow-hidden" data-testid="tomorrow-peek">
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="focus-ring flex w-full items-center gap-3 rounded-card p-5 text-left transition-colors hover:bg-surface-2/60"
        >
          <span aria-hidden className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-soft text-sky-ink">
            <CalendarCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold leading-snug text-ink">
              Tomorrow's plan is ready · {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} · {formatMinutes(total)}
            </span>
            <span className="block text-sm font-normal text-muted">{format(parseDate(date), 'EEEE, d MMMM')} · a little peek, nothing to do yet</span>
          </span>
          <ChevronDown aria-hidden className={cn('h-4 w-4 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </h2>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="panel"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <ul className="divide-y divide-line/70 border-t border-line/70">
              {ordered.map((t) => {
                const project = projects.find((p) => p.id === t.projectId);
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-5 py-3">
                    <PriorityBadge priority={t.priority} size="sm" />
                    <span className="min-w-0 flex-1 text-sm font-medium text-ink">{t.title}</span>
                    {project && <ProjectChip project={project} short />}
                    <span className="w-20 text-xs text-muted">{TIME_BLOCK_SHORT[t.timeBlock]}</span>
                    <span className="w-16 text-right text-xs tabular-nums text-muted">Std {formatMinutes(effectiveStandard(t))}</span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
