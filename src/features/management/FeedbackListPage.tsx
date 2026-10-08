import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarHeart, ChevronRight, MessageSquareHeart } from 'lucide-react';
import { peopleByRole, projectsForPerson, useNow, weekStartOf } from '@/store';
import { Avatar, Card, Page, ProgressBar, ProjectChip, SectionHeader, cn } from '@/components';
import { FeedbackStatusChip } from './feedback/FeedbackStatusChip';
import { lastSentFor, sharedOnLabel, useAppData, weekOfLabel, workWeekRange } from './feedback/feedbackModel';

/** Weekly feedback: every resource (alphabetical) with this week's report status. */
export default function FeedbackListPage() {
  const data = useAppData();
  const now = useNow(30_000);
  const weekStart = weekStartOf(data.demoDate);

  const rows = useMemo(
    () =>
      peopleByRole(data.people, 'resource').map((person) => ({
        person,
        projects: projectsForPerson(data, person.id),
        thisWeek: data.weeklyFeedback.find((f) => f.personId === person.id && f.weekStart === weekStart),
        lastSent: lastSentFor(data.weeklyFeedback, person.id),
      })),
    [data, weekStart],
  );

  const sentCount = rows.filter((r) => r.thisWeek?.status === 'sent').length;
  const allSent = rows.length > 0 && sentCount === rows.length;

  return (
    <Page
      title="Weekly feedback"
      eyebrow={
        <span className="inline-flex items-center gap-1.5">
          <CalendarHeart className="h-4 w-4" aria-hidden />
          {weekOfLabel(weekStart)} · {workWeekRange(weekStart)}
        </span>
      }
      subtitle="Drafts are prefilled from each person's own week. Give them a personal touch, then send."
    >
      <div className="space-y-6">
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-peach-soft text-xl">
              {allSent ? '☀️' : '💌'}
            </span>
            <div>
              <p className="text-base font-bold text-ink" data-testid="feedback-summary">
                {allSent ? 'All caught up ☀️' : `${sentCount} of ${rows.length} shared this week`}
              </p>
              <p className="text-sm text-muted">
                {allSent ? "Every report for this week is shared. Lovely work." : 'Reports land in each person’s My Progress.'}
              </p>
            </div>
          </div>
          <ProgressBar
            className="sm:ml-auto sm:w-64"
            value={sentCount}
            max={Math.max(1, rows.length)}
            tone="peach"
            ariaLabel="Reports shared this week"
          />
        </Card>

        <Card className="p-0" as="section" aria-labelledby="feedback-people">
          <div className="px-5 pt-5 sm:px-6">
            <SectionHeader
              id="feedback-people"
              icon={MessageSquareHeart}
              tone="peach"
              title="This week's reports"
              description="Sorted alphabetically."
            />
          </div>
          <div
            className="hidden grid-cols-[minmax(0,1.6fr)_7rem_minmax(0,1fr)_7.5rem] gap-4 border-b border-line/70 px-6 pb-2 text-[11px] font-semibold uppercase tracking-wider text-faint md:grid"
            aria-hidden
          >
            <span>Person</span>
            <span>This week</span>
            <span>Last shared</span>
            <span className="sr-only">Action</span>
          </div>
          <ul className="divide-y divide-line/70" data-testid="feedback-rows">
            {rows.map(({ person, projects, thisWeek, lastSent }) => (
              <li
                key={person.id}
                data-person={person.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,1.6fr)_7rem_minmax(0,1fr)_7.5rem]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar person={person} size="md" decorative />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{person.name}</p>
                    <div className="mt-1 flex min-w-0 flex-wrap gap-1">
                      {projects.length > 0 ? (
                        projects.map((p) => <ProjectChip key={p.id} project={p} short />)
                      ) : (
                        <span className="text-xs text-muted">{person.title}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-start-1 row-start-2 flex items-center gap-2 md:col-start-auto md:row-start-auto">
                  <span className="sr-only">This week:</span>
                  <FeedbackStatusChip status={thisWeek?.status} />
                  <span className="text-xs text-muted md:hidden">
                    {lastSent?.sentAt ? `Last shared ${sharedOnLabel(lastSent.sentAt, now)}` : 'Not shared yet'}
                  </span>
                </div>
                <p className="hidden text-sm text-muted md:block">
                  <span className="sr-only">Last shared: </span>
                  {lastSent?.sentAt ? sharedOnLabel(lastSent.sentAt, now) : 'Not shared yet'}
                </p>
                <div className="row-span-2 flex justify-end md:row-span-1">
                  <Link
                    to={`/feedback/${person.id}`}
                    aria-label={`Open ${person.firstName}'s feedback`}
                    className={cn(
                      'focus-ring group inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition',
                      thisWeek?.status === 'sent'
                        ? 'border border-line bg-surface text-ink hover:bg-surface-2'
                        : 'bg-accent text-accent-on shadow-soft hover:brightness-110',
                    )}
                  >
                    Open
                    <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </Page>
  );
}
