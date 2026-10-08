import { useId, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArchiveRestore, ChevronDown, Info, Plus } from 'lucide-react';
import { Button, Card, EmptyState, Page, toast, cn } from '@/components';
import { useApp, type TaskType } from '@/store';
import { CategoryChip } from './plan/ReviewerChip';
import { TaskTypeModal } from './plan/library/TaskTypeModal';
import { TaskTypeRow } from './plan/library/TaskTypeRow';
import { perUnitText } from './plan/planShared';

/** Task library (spec §8.2 G): editable task types with standard minutes per unit. */
export default function TaskLibraryPage() {
  const taskTypes = useApp((s) => s.taskTypes);
  const upsertTaskType = useApp((s) => s.upsertTaskType);
  const setTaskTypeArchived = useApp((s) => s.setTaskTypeArchived);
  const reduce = useReducedMotion();
  const archivedPanelId = useId();

  const active = useMemo(() => taskTypes.filter((t) => !t.archived), [taskTypes]);
  const archived = useMemo(() => taskTypes.filter((t) => t.archived), [taskTypes]);
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const save = (tt: TaskType) => {
    upsertTaskType(tt);
    toast({ title: `Saved “${tt.name}”`, description: 'Changes apply to new tasks only.', emoji: '📚' });
  };
  const add = (tt: TaskType) => {
    upsertTaskType(tt);
    setAdding(false);
    toast({ title: `Added “${tt.name}” to the library`, description: 'It’s ready to plan straight away.', tone: 'success', emoji: '✨' });
  };
  const archive = (tt: TaskType) => {
    setTaskTypeArchived(tt.id, true);
    toast({ title: `Archived “${tt.name}”`, description: 'It won’t be offered for new tasks. Restore it any time below.', tone: 'info', emoji: '🗄️' });
  };
  const restore = (tt: TaskType) => {
    setTaskTypeArchived(tt.id, false);
    toast({ title: `Restored “${tt.name}”`, description: 'It’s back in the library.', tone: 'success', emoji: '↩️' });
  };

  return (
    <Page
      title="Task library"
      subtitle="Predefined tasks with a standard time per unit — the building blocks of every plan."
      actions={
        <Button icon={Plus} onClick={() => setAdding(true)}>
          Add task type
        </Button>
      }
    >
      <p className="mb-5 flex items-start gap-2.5 rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-ink">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-bold">Changes apply to new tasks only.</strong> Tasks that are already planned or done keep the
          standard they started with.
        </span>
      </p>

      <Card padding="none" className="overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <caption className="sr-only">Task types. Edit the standard minutes inline, or use Edit for the rest of a row.</caption>
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-muted">
                <th scope="col" className="py-3 pl-5 pr-3 font-semibold">
                  Task
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Standard per unit
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Default reviewer
                </th>
                <th scope="col" className="px-3 py-3 font-semibold">
                  Category
                </th>
                <th scope="col" className="py-3 pl-3 pr-5 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {active.map((tt) => (
                <TaskTypeRow key={tt.id} taskType={tt} onSave={save} onArchive={archive} />
              ))}
            </tbody>
          </table>
        </div>
        {active.length === 0 && (
          <EmptyState
            emoji="📚"
            title="The library is empty"
            description="Add a task type to start planning."
            action={
              <Button icon={Plus} onClick={() => setAdding(true)}>
                Add task type
              </Button>
            }
          />
        )}
      </Card>

      <Card padding="none" className="mt-5 overflow-hidden">
        <h2 className="m-0">
          <button
            type="button"
            aria-expanded={showArchived}
            aria-controls={archivedPanelId}
            onClick={() => setShowArchived((v) => !v)}
            className="focus-ring flex w-full items-center gap-3 rounded-card px-5 py-4 text-left transition-colors hover:bg-surface-2/60"
          >
            <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-grey-soft text-grey-ink">
              🗄️
            </span>
            <span className="flex-1 text-base font-bold text-ink">
              Archived <span className="font-semibold text-muted">({archived.length})</span>
            </span>
            <ChevronDown aria-hidden className={cn('h-4 w-4 text-muted transition-transform duration-200', showArchived && 'rotate-180')} />
          </button>
        </h2>
        <AnimatePresence initial={false}>
          {showArchived && (
            <motion.div
              id={archivedPanelId}
              key="archived"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              {archived.length === 0 ? (
                <p className="border-t border-line/60 px-5 py-4 text-sm text-muted">Nothing archived — every task type is in use 🙂</p>
              ) : (
                <ul className="divide-y divide-line/60 border-t border-line/60" aria-label="Archived task types">
                  {archived.map((tt) => (
                    <li key={tt.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-muted">{tt.name}</span>
                        <span className="block text-xs text-faint">{perUnitText(tt)}</span>
                      </span>
                      <CategoryChip category={tt.category} />
                      <Button variant="soft" size="sm" icon={ArchiveRestore} onClick={() => restore(tt)} aria-label={`Restore ${tt.name}`}>
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <TaskTypeModal open={adding} onClose={() => setAdding(false)} onAdd={add} existingNames={taskTypes.map((t) => t.name)} />
    </Page>
  );
}
