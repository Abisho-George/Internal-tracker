import { useState } from 'react';
import { Check, Inbox, Undo2 } from 'lucide-react';
import { formatMinutes, personById, taskTypeById, useApp } from '@/store';
import type { AppData, ReviewTask } from '@/store/types';
import { Avatar, Button, Card, SectionHeader, TextInput, toast } from '@/components';
import { quantityLabel } from './helpers';

export interface WaitingOnMeProps {
  reviews: ReviewTask[];
  data: Pick<AppData, 'tasks' | 'people' | 'taskTypes'>;
}

function ReviewRow({ review, data }: { review: ReviewTask; data: WaitingOnMeProps['data'] }) {
  const approveReview = useApp((s) => s.approveReview);
  const sendBackReview = useApp((s) => s.sendBackReview);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');
  const task = data.tasks.find((t) => t.id === review.sourceTaskId);
  const author = personById(data.people, task?.assigneeId);
  if (!task) return null;
  const tt = taskTypeById(data.taskTypes, task.taskTypeId);

  return (
    <li className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        {author && <Avatar person={author} size="sm" decorative />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{task.title}</p>
          <p className="text-xs text-muted">
            {author?.firstName ?? 'A teammate'} · {quantityLabel(task.quantityDone ?? task.quantity, tt)}
            {task.actualMinutes != null && ` · ${formatMinutes(task.actualMinutes)}`}
          </p>
        </div>
      </div>
      {sending ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendBackReview(review.id, note);
            toast({ title: `Note sent to ${author?.firstName ?? 'your teammate'}`, tone: 'info', emoji: '🌱' });
          }}
        >
          <TextInput
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What would make it good to go?"
            aria-label={`Note for ${task.title}`}
            maxLength={200}
          />
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={!note.trim()}>
              Send note
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSending(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={Check}
            onClick={() => {
              approveReview(review.id);
              toast({ title: `Approved ✓ — ${author?.firstName ?? 'your teammate'} will see it`, emoji: '✅' });
            }}
          >
            Approve
          </Button>
          <Button size="sm" variant="secondary" icon={Undo2} onClick={() => setSending(true)}>
            Send back with note
          </Button>
        </div>
      )}
    </li>
  );
}

/** Reviews this person owes (rare for resources; only rendered when non-empty). */
export function WaitingOnMe({ reviews, data }: WaitingOnMeProps) {
  if (reviews.length === 0) return null;
  return (
    <Card data-testid="waiting-on-me">
      <SectionHeader
        title="Waiting on me"
        description={`${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'} for you`}
        icon={Inbox}
        tone="sky"
        as="h2"
      />
      <ul className="divide-y divide-line/70">
        {reviews.map((r) => (
          <ReviewRow key={r.id} review={r} data={data} />
        ))}
      </ul>
    </Card>
  );
}
