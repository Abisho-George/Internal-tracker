import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { parseDate, usePerson } from '@/store';
import type { PastelKey, WeeklyFeedback } from '@/store/types';
import { Button, Modal, TONE_SOFT_BG, TONE_STRONG_BG, cn } from '@/components';
import { weekOfLabel } from './components/helpers';

export interface FeedbackViewModalProps {
  feedback?: WeeklyFeedback;
  open: boolean;
  onClose: () => void;
}

function Section({
  title,
  emoji,
  tone,
  items,
  bullet = 'dot',
}: {
  title: string;
  emoji?: string;
  tone: PastelKey;
  items: string[];
  bullet?: 'dot' | 'arrow';
}) {
  return (
    <section className={cn('rounded-2xl p-4 sm:p-5', tone === 'grey' ? 'bg-surface-2' : TONE_SOFT_BG[tone])}>
      <h3 className="flex items-center gap-2 text-base font-bold text-ink">
        {title}
        {emoji && <span aria-hidden>{emoji}</span>}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing added this week.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item, i) => (
            <li key={`${i}-${item}`} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
              {bullet === 'arrow' ? (
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
              ) : (
                <span aria-hidden className={cn('mt-2 h-1.5 w-1.5 shrink-0 rounded-full', TONE_STRONG_BG[tone])} />
              )}
              <span className="min-w-0">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A sent weekly feedback report, read-only. */
export function FeedbackViewModal({ feedback, open, onClose }: FeedbackViewModalProps) {
  const sender = usePerson(feedback?.sentById);
  let description: ReactNode = undefined;
  if (feedback) {
    const parts = [sender ? `From ${sender.name}` : undefined, feedback.sentAt ? `shared ${format(parseDate(feedback.sentAt), 'EEE d MMM')}` : undefined];
    description = parts.filter(Boolean).join(' · ') || undefined;
  }

  return (
    <Modal
      open={open && !!feedback}
      onClose={onClose}
      size="lg"
      title={feedback ? `Your weekly feedback · ${weekOfLabel(feedback.weekStart)}` : 'Your weekly feedback'}
      description={description}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {feedback && (
        <div className="space-y-4" data-testid="feedback-view">
          <Section title="Areas where you shone" emoji="⭐" tone="mint" items={feedback.shine} />
          <Section title="Areas to grow" emoji="🌱" tone="butter" items={feedback.improve} />
          <Section title="Next steps" tone="grey" items={feedback.nextSteps} bullet="arrow" />
          <p className="text-xs text-muted">Read-only · this report is just between you and your managers.</p>
        </div>
      )}
    </Modal>
  );
}

export default FeedbackViewModal;
