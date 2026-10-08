import { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CircleCheckBig, CloudSun, Plus, Shuffle, Sun, Sunrise, type LucideIcon } from 'lucide-react';
import {
  TIME_BLOCK_LABEL,
  addDaysISO,
  dayProgress,
  formatMinutes,
  greetingFor,
  loggingStreak,
  nextWorkingDay,
  parseDate,
  pendingReviewsFor,
  personById,
  projectsForPerson,
  rateTask,
  ratingMix,
  tasksForPersonOnDate,
  useApp,
  useCurrentUser,
  useNow,
  useToday,
} from '@/store';
import type { LightDay, Task, TimeBlock } from '@/store/types';
import { Button, Card, Chip, DayProgressLine, EmptyState, Page } from '@/components';
import { AddTaskModal } from './AddTaskModal';
import { MarkDoneModal } from './MarkDoneModal';
import { DailyNoteCard } from './components/DailyNoteCard';
import { StreakCard } from './components/StreakCard';
import { TaskCard } from './components/TaskCard';
import { TomorrowPeek } from './components/TomorrowPeek';
import { VoiceEntryButton } from './components/VoiceEntryButton';
import { WaitingOnMe } from './components/WaitingOnMe';
import { WrapUpCard } from './components/WrapUpCard';
import { TIME_BLOCKS, useAppData } from './components/helpers';

const BLOCK_ICON: Record<TimeBlock, LucideIcon> = { morning: Sunrise, afternoon: Sun, anytime: Shuffle };

/** The next light day within a week that applies to this person's projects. */
function upcomingLightDay(lightDays: LightDay[], today: string, projectIds: string[]): LightDay | undefined {
  const horizon = addDaysISO(today, 7);
  return lightDays
    .filter(
      (ld) =>
        ld.date > today &&
        ld.date <= horizon &&
        (ld.projectIds === 'all' || ld.projectIds.some((id) => projectIds.includes(id))),
    )
    .sort((a, b) => a.date.localeCompare(b.date))[0];
}

/** Resource home: today's tasks by time block, the day progress line, the daily note. */
export default function MyDayPage() {
  const me = useCurrentUser();
  const today = useToday();
  const now = useNow();
  const data = useAppData();
  const startTask = useApp((s) => s.startTask);

  const [justCompletedId, setJustCompletedId] = useState<string>();
  const [markDone, setMarkDone] = useState<{ taskId: string; key: number; open: boolean }>();
  const [addTask, setAddTask] = useState<{ key: number; open: boolean }>({ key: 0, open: false });

  const myTasks = useMemo(() => tasksForPersonOnDate(data.tasks, me.id, today), [data.tasks, me.id, today]);
  const progress = useMemo(() => dayProgress(data, me.id, today), [data, me.id, today]);
  const myProjects = useMemo(() => projectsForPerson(data, me.id), [data, me.id]);
  const lightDaySoon = useMemo(() => {
    const ids = Array.from(new Set([...myProjects.map((p) => p.id), ...myTasks.map((t) => t.projectId)]));
    return upcomingLightDay(data.lightDays, today, ids);
  }, [data.lightDays, today, myProjects, myTasks]);
  const reviews = useMemo(() => pendingReviewsFor(data, me.id), [data, me.id]);
  const tomorrow = nextWorkingDay(today);
  const tomorrowTasks = useMemo(() => tasksForPersonOnDate(data.tasks, me.id, tomorrow), [data.tasks, me.id, tomorrow]);
  const todayMix = useMemo(() => ratingMix(myTasks, data.settings), [myTasks, data.settings]);
  const streak = useMemo(() => loggingStreak(data, me.id), [data, me.id]);

  const groups = useMemo(
    () =>
      TIME_BLOCKS.map((block) => ({ block, tasks: myTasks.filter((t) => t.timeBlock === block) })).filter(
        (g) => g.tasks.length > 0,
      ),
    [myTasks],
  );

  // The 8-hour moment (on a light day, the reduced target counts as the full day).
  const dayComplete = progress.targetMinutes > 0 && progress.loggedMinutes >= progress.targetMinutes;
  const allDone = progress.totalCount > 0 && progress.doneCount === progress.totalCount;
  const markDoneTask = markDone ? data.tasks.find((t) => t.id === markDone.taskId) : undefined;

  const openMarkDone = useCallback((task: Task) => {
    setMarkDone((m) => ({ taskId: task.id, key: (m?.key ?? 0) + 1, open: true }));
  }, []);
  const openAddTask = useCallback(() => setAddTask((a) => ({ key: a.key + 1, open: true })), []);
  const onStart = useCallback((task: Task) => startTask(task.id), [startTask]);
  const onCompleted = useCallback((taskId: string) => {
    setJustCompletedId(taskId);
    // The Mark done button is gone now: put keyboard focus on the finished card.
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`)?.focus({ preventScroll: true });
    }, 60);
  }, []);

  const summary =
    progress.totalCount === 0
      ? 'Nothing planned yet'
      : `${progress.doneCount} of ${progress.totalCount} ${progress.totalCount === 1 ? 'task' : 'tasks'} done · ${formatMinutes(progress.loggedMinutes)} logged`;

  const actions = dayComplete ? (
    <Chip tone="mint" icon={CircleCheckBig} data-testid="day-complete" className="px-3.5 py-2 text-sm">
      Day complete
    </Chip>
  ) : (
    <>
      <VoiceEntryButton />
      <Button icon={Plus} onClick={openAddTask}>
        Add task
      </Button>
    </>
  );

  return (
    <Page
      documentTitle="My Day"
      eyebrow={format(parseDate(today), 'EEEE, d MMMM')}
      title={`${greetingFor(now)}, ${me.firstName} 👋`}
      subtitle={<span data-testid="day-summary">{summary}</span>}
      actions={actions}
    >
      <div className="space-y-6">
        {dayComplete && (
          <WrapUpCard
            personId={me.id}
            date={today}
            loggedMinutes={progress.loggedMinutes}
            doneCount={progress.doneCount}
            mix={todayMix}
          />
        )}

        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className="text-base font-bold text-ink">Today's progress</h2>
            {lightDaySoon && (
              <Chip tone="butter" icon={CloudSun} className="whitespace-normal" data-testid="light-day-soon">
                {format(parseDate(lightDaySoon.date), 'EEE d MMM')} is a light day · {lightDaySoon.reason}
                {lightDaySoon.reason.includes('%') ? '' : ` – targets at ${lightDaySoon.adjustedTargetPercent}%`}
              </Chip>
            )}
          </div>
          <DayProgressLine
            loggedMinutes={progress.loggedMinutes}
            workdayMinutes={progress.workdayMinutes}
            targetMinutes={progress.lightDay ? progress.targetMinutes : undefined}
            lightDayReason={progress.lightDay?.reason}
          />
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {allDone && !dayComplete && (
              <Card
                className="flex items-center gap-4 bg-gradient-to-r from-mint-soft/70 to-sky-soft/60 p-4 sm:p-5"
                data-testid="all-caught-up"
              >
                <span aria-hidden className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface/80 text-2xl shadow-soft">
                  🙌
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-ink">All caught up ☀️</p>
                  <p className="text-sm text-ink/80">
                    Everything on today's list is done. Picked something else up? Use “Add task” so it counts.
                  </p>
                </div>
              </Card>
            )}
            {groups.length === 0 ? (
              <Card>
                <EmptyState
                  emoji="🌤️"
                  title="All caught up ☀️"
                  description="Nothing is planned for today yet. Add a task when you pick something up."
                  action={
                    !dayComplete && (
                      <Button icon={Plus} variant="soft" onClick={openAddTask}>
                        Add task
                      </Button>
                    )
                  }
                />
              </Card>
            ) : (
              groups.map(({ block, tasks }) => {
                const Icon = BLOCK_ICON[block];
                const done = tasks.filter((t) => t.status === 'done').length;
                return (
                  <section key={block} aria-labelledby={`block-${block}`} data-testid={`block-${block}`}>
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span aria-hidden className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
                        <Icon className="h-4 w-4" />
                      </span>
                      <h2 id={`block-${block}`} className="text-lg font-bold text-ink">
                        {TIME_BLOCK_LABEL[block]}
                      </h2>
                      <span className="text-sm text-muted">
                        {done === tasks.length ? 'All done ✓' : `${done} of ${tasks.length} done`}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          taskType={data.taskTypes.find((x) => x.id === task.taskTypeId)}
                          project={data.projects.find((p) => p.id === task.projectId)}
                          rating={rateTask(task, data.settings)}
                          reviewerName={personById(data.people, task.reviewerId)?.firstName}
                          adjustedByName={personById(data.people, task.dayAdjustment?.byPmId)?.firstName}
                          justCompleted={justCompletedId === task.id}
                          onStart={onStart}
                          onMarkDone={openMarkDone}
                        />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </div>

          <aside className="min-w-0 space-y-6 xl:sticky xl:top-24 xl:self-start" aria-label="Notes and reviews">
            <DailyNoteCard personId={me.id} date={today} />
            <WaitingOnMe reviews={reviews} data={data} />
            <StreakCard days={streak} variant="compact" />
          </aside>
        </div>

        {tomorrowTasks.length > 0 && <TomorrowPeek date={tomorrow} tasks={tomorrowTasks} projects={data.projects} />}
      </div>

      {markDone && (
        <MarkDoneModal
          key={markDone.key}
          task={markDoneTask}
          taskType={data.taskTypes.find((x) => x.id === markDoneTask?.taskTypeId)}
          open={markDone.open}
          onClose={() => setMarkDone((m) => (m ? { ...m, open: false } : m))}
          onCompleted={onCompleted}
        />
      )}
      <AddTaskModal
        key={addTask.key}
        open={addTask.open}
        onClose={() => setAddTask((a) => ({ ...a, open: false }))}
        personId={me.id}
        date={today}
      />
    </Page>
  );
}
