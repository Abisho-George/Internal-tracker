import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck, CircleCheck, Copy, Library, Save } from 'lucide-react';
import { Avatar, Button, Card, EmptyState, Modal, Page, SectionHeader, SegmentedControl, toast } from '@/components';
import {
  DEFAULT_MANAGEMENT_REVIEWER_ID,
  effectiveStandard,
  isWorkingDay,
  lightDayFor,
  nextWorkingDay,
  peopleByRole,
  plannedMinutes,
  previousWorkingDay,
  projectsForPerson,
  tasksForPersonOnDate,
  teamForPm,
  useApp,
  useCurrentUser,
  useSettings,
  useToday,
  type Project,
  type TaskType,
} from '@/store';
import { friendlyDay, longDate, shortDate, usePlanData } from './plan/planShared';
import { FixedTaskList, type FixedItem } from './plan/day/FixedTaskList';
import { PersonPicker } from './plan/day/PersonPicker';
import { PlanHoursBar } from './plan/day/PlanHoursBar';
import { PlanLibrary, type LibraryGroup } from './plan/day/PlanLibrary';
import { PlanRowCard, reviewerOptionsFor } from './plan/day/PlanRowCard';
import { copyRow, loadRows, newRow, rowsSignature, toPlanRow, type DraftRow } from './plan/day/planModel';
import { LinkButton } from './plan/LinkButton';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface Draft {
  key: string;
  rows: DraftRow[];
  baseline: string;
}

/** Plan the day (spec §8.2 D): pick a day and a person, click tasks in, tweak, save. */
export default function PlanDayPage() {
  const data = usePlanData();
  const me = useCurrentUser();
  const today = useToday();
  const settings = useSettings();
  const savePlan = useApp((s) => s.savePlan);
  const [params, setParams] = useSearchParams();
  const reduce = useReducedMotion();
  const dateInputId = useId();

  const isPm = me.role === 'pm';
  const team = useMemo(
    () => (isPm ? teamForPm({ people: data.people, projects: data.projects }, me.id) : peopleByRole(data.people, 'resource')),
    [isPm, data.people, data.projects, me.id],
  );

  const tomorrow = nextWorkingDay(today);
  const paramPerson = params.get('person');
  const person = team.find((p) => p.id === paramPerson) ?? team[0];
  const paramDate = params.get('date');
  const date = paramDate && ISO_DATE.test(paramDate) && !Number.isNaN(Date.parse(paramDate)) ? paramDate : tomorrow;
  const sourceDate = previousWorkingDay(date);

  /** PMs plan their own projects; management can plan any. */
  const canEdit = useCallback(
    (projectId: string) => {
      const project = data.projects.find((p) => p.id === projectId);
      return !!project && (!isPm || project.pmId === me.id);
    },
    [data.projects, isPm, me.id],
  );

  // ---- draft rows (reloaded whenever the person, date or viewer changes) ----
  const key = person ? `${me.id}|${person.id}|${date}` : '';
  const load = (): DraftRow[] => (person ? loadRows(useApp.getState(), person.id, date, canEdit) : []);
  const [draft, setDraft] = useState<Draft>(() => {
    const rows = load();
    return { key, rows, baseline: rowsSignature(rows) };
  });
  if (draft.key !== key) {
    const rows = load();
    setDraft({ key, rows, baseline: rowsSignature(rows) });
  }
  const rows = draft.rows;
  const editableRows = rows.filter((r) => !r.locked);
  const dirty = rowsSignature(rows) !== draft.baseline;

  const [announcement, setAnnouncement] = useState('');

  // ---- derived ----
  const groups = useMemo<LibraryGroup[]>(() => {
    if (!person) return [];
    return data.projects
      .filter((p) => p.status === 'active' && p.resourceIds.includes(person.id) && canEdit(p.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((project) => ({
        project,
        taskTypes: data.taskTypes.filter((t) => !t.archived && project.taskTypeIds.includes(t.id)),
        otherTypes: data.taskTypes.filter((t) => !t.archived && !project.taskTypeIds.includes(t.id)),
      }));
  }, [person, data.projects, data.taskTypes, canEdit]);

  const dayTasks = useMemo(() => (person ? tasksForPersonOnDate(data.tasks, person.id, date) : []), [data.tasks, person, date]);
  const fixedItems = useMemo<FixedItem[]>(
    () =>
      dayTasks
        .filter((t) => t.status !== 'upNext' || !canEdit(t.projectId))
        .map((task) => {
          const project = data.projects.find((p) => p.id === task.projectId);
          return {
            task,
            plannedBy: task.status === 'upNext' ? data.people.find((p) => p.id === project?.pmId) : undefined,
          };
        }),
    [dayTasks, canEdit, data.projects, data.people],
  );
  const fixedMinutes = fixedItems.reduce((s, i) => s + effectiveStandard(i.task), 0);
  const rowsMinutes = editableRows.reduce((s, r) => s + r.standardMinutes, 0);
  const workdayMinutes = Math.round(settings.workdayHours * 60);
  const total = fixedMinutes + rowsMinutes;

  const lightDay = useMemo(() => {
    if (!person) return undefined;
    const ids = projectsForPerson({ people: data.people, projects: data.projects }, person.id).map((p) => p.id);
    return lightDayFor(data.lightDays, date, ids);
  }, [person, data.people, data.projects, data.lightDays, date]);
  const targetMinutes = lightDay ? Math.round((workdayMinutes * lightDay.adjustedTargetPercent) / 100) : undefined;

  const plannedByPerson = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of team) out[p.id] = plannedMinutes(tasksForPersonOnDate(data.tasks, p.id, date));
    return out;
  }, [team, data.tasks, date]);

  const sourceTasks = useMemo(() => (person ? tasksForPersonOnDate(data.tasks, person.id, sourceDate) : []), [data.tasks, person, sourceDate]);

  // ---- navigation (person / date live in the URL) ----
  const setSelection = (personId: string, nextDate: string) => {
    const next = new URLSearchParams(params);
    next.set('person', personId);
    next.set('date', nextDate);
    setParams(next, { replace: true });
  };

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );
  // Once the draft is saved or discarded (or reloaded for another viewer), let the navigation through.
  useEffect(() => {
    if (blocker.state === 'blocked' && !dirty) blocker.proceed();
  }, [blocker, dirty]);

  // ---- row actions ----
  const setRows = (fn: (rows: DraftRow[]) => DraftRow[]) => setDraft((d) => ({ ...d, rows: fn(d.rows) }));

  const addRow = (project: Project, taskType: TaskType) => {
    setRows((rs) => [...rs, newRow(project, taskType)]);
    setAnnouncement(`Added ${taskType.name} for ${project.client}`);
  };
  const updateRow = (rowKey: string, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)));
  const removeRow = (row: DraftRow, name: string) => {
    setRows((rs) => rs.filter((r) => r.key !== row.key));
    setAnnouncement(`Removed ${name}`);
  };

  const copyYesterday = () => {
    if (!person) return;
    const copyable = sourceTasks.filter((t) => canEdit(t.projectId));
    const skipped = sourceTasks.length - copyable.length;
    if (copyable.length === 0) {
      toast({
        title: `Nothing to copy from ${shortDate(sourceDate)}`,
        description: skipped ? 'Those tasks belong to another PM’s projects.' : `${person.firstName} had no tasks that day.`,
        tone: 'info',
      });
      return;
    }
    setRows((rs) => [...rs, ...copyable.map((t) => copyRow(t, data.taskTypes))]);
    toast({
      title: `Copied ${copyable.length} ${copyable.length === 1 ? 'task' : 'tasks'} from ${sourceDate === today ? 'today' : shortDate(sourceDate)}`,
      description: skipped
        ? `${skipped} on another PM’s project stayed with them. Tweak anything, then save.`
        : 'Tweak anything you like, then save the plan.',
      tone: 'info',
      emoji: '📋',
    });
    setAnnouncement(`Copied ${copyable.length} tasks`);
  };

  const save = () => {
    if (!person) return;
    savePlan(person.id, date, rows.map(toPlanRow));
    const fresh = loadRows(useApp.getState(), person.id, date, canEdit);
    setDraft({ key, rows: fresh, baseline: rowsSignature(fresh) });
    toast({ title: `Plan saved — ${person.firstName} will see it on My Day`, tone: 'success', emoji: '🗓️' });
  };

  const discard = () => {
    const fresh = load();
    setDraft({ key, rows: fresh, baseline: rowsSignature(fresh) });
  };

  // ---- render ----
  if (!person) {
    return (
      <Page title="Plan the day" subtitle="Pick a person and a day, click tasks in, then save.">
        <Card>
          <EmptyState
            emoji="🗓️"
            title="No one to plan for yet"
            description="Once a project has people on it, you can plan their days here."
            action={<LinkButton to="/projects/new">Set up a project</LinkButton>}
          />
        </Card>
      </Page>
    );
  }

  const dayName = friendlyDay(date, today, tomorrow);
  const dayChoice = date === today ? 'today' : date === tomorrow ? 'tomorrow' : '';
  const over = total > workdayMinutes;

  return (
    <Page title="Plan the day" subtitle="Pick a day and a person, click tasks in from the library, then save.">
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <Card className="mb-5 space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-sm font-semibold text-ink">Day</span>
          <SegmentedControl<string>
            ariaLabel="Day"
            value={dayChoice}
            onChange={(v) => setSelection(person.id, v === 'today' ? today : tomorrow)}
            options={[
              { value: 'today', label: 'Today' },
              { value: 'tomorrow', label: 'Tomorrow' },
            ]}
          />
          <label htmlFor={dateInputId} className="sr-only">
            Pick a date
          </label>
          <input
            id={dateInputId}
            type="date"
            value={date}
            onChange={(e) => ISO_DATE.test(e.target.value) && setSelection(person.id, e.target.value)}
            className="input h-9 w-auto py-1"
          />
          <span className="text-sm text-muted">{longDate(date)}</span>
        </div>
        <PersonPicker people={team} selectedId={person.id} plannedByPerson={plannedByPerson} onSelect={(id) => setSelection(id, date)} />
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card as="aside" aria-label="Task library" className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto">
          <SectionHeader
            icon={Library}
            tone="lavender"
            title="Task library"
            description={`Click a task to add it to ${person.firstName}'s day.`}
          />
          <PlanLibrary groups={groups} personFirstName={person.firstName} onAdd={addRow} />
        </Card>

        <section aria-labelledby="plan-title" className="min-w-0">
          <div className="sticky top-20 z-10 mb-4">
            <Card padding="sm" className="border-line shadow-lift">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <PlanHoursBar
                  className="min-w-[16rem] flex-1"
                  fixedMinutes={fixedMinutes}
                  plannedMinutes={rowsMinutes}
                  workdayMinutes={workdayMinutes}
                  targetMinutes={targetMinutes}
                />
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {dirty && (
                    <Button variant="ghost" onClick={discard}>
                      Discard changes
                    </Button>
                  )}
                  <Button icon={Save} onClick={save} disabled={!dirty}>
                    {dirty ? 'Save plan' : 'Plan saved'}
                  </Button>
                </div>
              </div>
              {over && (
                <p className="mt-3 rounded-xl bg-butter-soft px-3 py-2 text-sm font-medium text-butter-ink">
                  <span aria-hidden>☕ </span>That's more than a full day — maybe move something to tomorrow?
                </p>
              )}
              {!over && lightDay && targetMinutes !== undefined && total > targetMinutes && (
                <p className="mt-3 rounded-xl bg-butter-soft px-3 py-2 text-sm font-medium text-butter-ink">
                  <span aria-hidden>🌤️ </span>It's a light day — about {Math.round((targetMinutes / 60) * 10) / 10}h is plenty.
                </p>
              )}
            </Card>
          </div>

          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar person={person} size="lg" decorative />
                <div className="min-w-0">
                  <h2 id="plan-title" className="text-lg font-bold leading-snug">
                    {person.firstName}'s plan · {dayName}
                  </h2>
                  <p className="text-sm text-muted">
                    {longDate(date)}
                    {dirty ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-butter-soft px-2 py-0.5 text-xs font-semibold text-butter-ink">
                        Unsaved changes
                      </span>
                    ) : (
                      editableRows.length > 0 && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-mint-ink">
                          <CircleCheck className="h-3.5 w-3.5" aria-hidden /> Saved
                        </span>
                      )
                    )}
                  </p>
                </div>
              </div>
              <Button variant="secondary" icon={Copy} onClick={copyYesterday} title={`Copies every task from ${shortDate(sourceDate)}`}>
                Copy yesterday's plan
              </Button>
            </div>

            {lightDay && (
              <p className="rounded-2xl bg-butter-soft px-4 py-2.5 text-sm text-butter-ink">
                <span aria-hidden>🌤️ </span>
                <strong className="font-semibold">Light day</strong> · {lightDay.reason} · target {lightDay.adjustedTargetPercent}% (
                {Math.round((settings.workdayHours * lightDay.adjustedTargetPercent) / 100 * 10) / 10}h)
              </p>
            )}
            {!isWorkingDay(date) && (
              <p className="rounded-2xl bg-sky-soft px-4 py-2.5 text-sm text-sky-ink">
                <span aria-hidden>🌴 </span>That's a weekend day — only plan it if it's really needed.
              </p>
            )}
            {date < today && (
              <p className="rounded-2xl bg-sky-soft px-4 py-2.5 text-sm text-sky-ink">This day has already passed — changes still save.</p>
            )}

            <FixedTaskList items={fixedItems} projects={data.projects} people={data.people} settings={settings} />

            {editableRows.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-line/80">
                <EmptyState
                  compact
                  emoji="🗓️"
                  title={fixedItems.length ? 'Nothing else up next yet' : `Nothing planned for ${person.firstName} yet`}
                  description={`Click a task in the library, or copy ${shortDate(sourceDate)}'s plan to start from it.`}
                  action={
                    <Button variant="soft" icon={Copy} onClick={copyYesterday}>
                      Copy yesterday's plan
                    </Button>
                  }
                />
              </div>
            ) : (
              <ul className="space-y-3" aria-label={`${person.firstName}'s plan rows`}>
                <AnimatePresence initial={false}>
                  {editableRows.map((row) => {
                    const project = data.projects.find((p) => p.id === row.projectId);
                    const taskType = data.taskTypes.find((t) => t.id === row.taskTypeId);
                    const name = taskType?.name ?? row.title ?? 'task';
                    return (
                      <motion.li
                        key={row.key}
                        layout={reduce ? false : 'position'}
                        initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.16 } }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                      >
                        <PlanRowCard
                          row={row}
                          taskType={taskType}
                          project={project}
                          reviewerOptions={reviewerOptionsFor(project, data.people, DEFAULT_MANAGEMENT_REVIEWER_ID, row.reviewerId)}
                          onChange={(patch) => updateRow(row.key, patch)}
                          onRemove={() => removeRow(row, name)}
                        />
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </Card>

        </section>
      </div>

      <Modal
        open={blocker.state === 'blocked' && dirty}
        onClose={() => blocker.reset?.()}
        size="md"
        title={`Save ${person.firstName}'s plan first?`}
        description={`You have unsaved changes for ${shortDate(date)}.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => blocker.reset?.()}>
              Keep editing
            </Button>
            {/* Both clear the draft; the effect above then lets the navigation through. */}
            <Button variant="secondary" onClick={discard}>
              Discard
            </Button>
            <Button icon={CalendarCheck} onClick={save}>
              Save &amp; continue
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Saving now means {person.firstName} sees the plan on My Day.</p>
      </Modal>
    </Page>
  );
}
