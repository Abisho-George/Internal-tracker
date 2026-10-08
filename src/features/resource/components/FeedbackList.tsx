import { format } from 'date-fns';
import { ChevronRight, MessageSquareHeart } from 'lucide-react';
import { parseDate, personById } from '@/store';
import type { Person, WeeklyFeedback } from '@/store/types';
import { Card, EmptyState, SectionHeader } from '@/components';
import { weekOfLabel } from './helpers';

export interface FeedbackListProps {
  feedback: WeeklyFeedback[];
  people: Person[];
  onOpen: (feedback: WeeklyFeedback) => void;
}

/** Sent weekly feedback for this person, newest first. Each opens read-only. */
export function FeedbackList({ feedback, people, onOpen }: FeedbackListProps) {
  return (
    <Card className="p-5 sm:p-6" data-testid="feedback-list">
      <SectionHeader
        title="My weekly feedback"
        description="Reports shared with you. Open one to read it."
        icon={MessageSquareHeart}
        tone="peach"
      />
      {feedback.length === 0 ? (
        <EmptyState compact emoji="🌱" title="Your first weekly feedback will land here" description="Reports appear as soon as they're shared with you." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {feedback.map((f) => {
            const sender = personById(people, f.sentById);
            const week = weekOfLabel(f.weekStart);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onOpen(f)}
                  data-testid="feedback-row"
                  aria-label={`Open feedback: ${week}`}
                  className="focus-ring group flex h-full w-full items-center gap-4 rounded-2xl border border-line/70 bg-surface px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-line hover:bg-surface-2/60 hover:shadow-soft motion-reduce:hover:translate-y-0"
                >
                  <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-lg">
                    ⭐
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{week}</span>
                    <span className="block text-xs text-muted">
                      {sender ? `From ${sender.firstName}` : 'Shared with you'}
                      {f.sentAt && ` · ${format(parseDate(f.sentAt), 'EEE d MMM')}`}
                    </span>
                    {f.shine[0] && <span className="mt-1 block truncate text-xs text-muted">“{f.shine[0]}”</span>}
                  </span>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
