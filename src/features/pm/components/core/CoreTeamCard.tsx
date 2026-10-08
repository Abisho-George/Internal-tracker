import { CalendarPlus, CheckCircle2, NotebookPen, StickyNote } from 'lucide-react';
import { Avatar, Card, DayProgressLine, Popover, ProjectChip, RatingChip, Tooltip, cn } from '@/components';
import { formatClock, formatMinutes, type DailyNote, type DayProgress, type Person, type Project } from '@/store';
import { CoreLinkButton } from './CoreLinkButton';

export interface CoreTeamCardProps {
  person: Person;
  progress: DayProgress;
  /** This PM's projects the person works on. */
  projects: Project[];
  note?: DailyNote;
  inProgressCount: number;
}

/** One teammate's day at a glance (PM Home → Team today). */
export function CoreTeamCard({ person, progress, projects, note, inProgressCount }: CoreTeamCardProps) {
  const { loggedMinutes, workdayMinutes, targetMinutes, lightDay, doneCount, totalCount, latestRating } = progress;
  return (
    <Card className="flex h-full flex-col gap-4 p-5" data-team-card={person.id}>
      <div className="flex items-start gap-3">
        <Avatar person={person} size="md" decorative />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold leading-tight text-ink">{person.name}</h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {projects.map((p) => (
              <ProjectChip key={p.id} project={p} short />
            ))}
          </div>
        </div>
        <NoteButton person={person} note={note} />
      </div>

      <div className="space-y-2">
        <DayProgressLine
          compact
          loggedMinutes={loggedMinutes}
          workdayMinutes={workdayMinutes}
          targetMinutes={lightDay ? targetMinutes : undefined}
          lightDayReason={lightDay?.reason}
        />
        {lightDay && (
          <p className="flex items-start gap-1.5 text-xs leading-snug text-muted" data-light-day>
            <span aria-hidden className="mt-0.5 inline-block h-3 w-0 shrink-0 border-l-2 border-dashed border-butter-strong" />
            <span>
              <span className="font-semibold text-butter-ink">Light day</span> · target {formatMinutes(targetMinutes)} ·{' '}
              {lightDay.reason}
            </span>
          </p>
        )}
      </div>

      <p className="inline-flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <CheckCircle2 className="h-4 w-4 text-mint-ink" aria-hidden />
        <span>
          <span className="font-semibold tabular-nums text-ink">
            {doneCount} of {totalCount}
          </span>{' '}
          tasks done
        </span>
        {inProgressCount > 0 && <span className="text-muted">· {inProgressCount} in progress</span>}
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
        {latestRating ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span>Latest rating</span>
            <RatingChip rating={latestRating} size="sm" />
          </span>
        ) : (
          <span className="text-xs text-muted">No ratings yet today</span>
        )}
        <CoreLinkButton
          to={`/plan?person=${encodeURIComponent(person.id)}`}
          variant="soft"
          size="sm"
          icon={CalendarPlus}
          aria-label={`Plan ${person.firstName}'s day`}
        >
          Plan
        </CoreLinkButton>
      </div>
    </Card>
  );
}

/** Opens the teammate's daily note; a muted icon when there is none. */
function NoteButton({ person, note }: { person: Person; note?: DailyNote }) {
  if (!note) {
    return (
      <Tooltip content="No note today">
        <span
          tabIndex={0}
          role="img"
          aria-label={`${person.firstName}: no note today`}
          className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-lg text-faint"
        >
          <StickyNote className="h-4 w-4" aria-hidden />
        </span>
      </Tooltip>
    );
  }
  return (
    <Popover
      kind="dialog"
      align="end"
      label={`${person.firstName}'s note for today`}
      panelClassName="w-72"
      renderTrigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`Read ${person.firstName}'s note`}
          className={cn(
            'focus-ring relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-butter-soft text-butter-ink transition hover:brightness-95',
          )}
        >
          <NotebookPen className="h-4 w-4" aria-hidden />
          <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-butter-strong ring-2 ring-surface" />
        </button>
      )}
    >
      <div className="p-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{person.firstName}'s note</p>
        <p className="mt-1.5 text-sm leading-relaxed text-ink">“{note.text}”</p>
        <p className="mt-2 text-xs text-muted">Written at {formatClock(note.updatedAt)}</p>
      </div>
    </Popover>
  );
}
