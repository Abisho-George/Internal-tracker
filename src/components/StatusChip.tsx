import { Check, Circle, Send, Sprout } from 'lucide-react';
import type { ReviewStatus, TaskStatus } from '@/store/types';
import { Chip, type ChipSize } from './Chip';

export interface StatusChipProps {
  status: TaskStatus;
  reviewStatus?: ReviewStatus;
  /** First name of the reviewer, for "Done · sent to Meera for review". */
  reviewerName?: string;
  size?: ChipSize;
  className?: string;
}

/** Gently pulsing dot for "In progress". */
function PulseDot() {
  return (
    <span aria-hidden className="relative inline-flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lavender-strong opacity-60" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-lavender-strong" />
    </span>
  );
}

/** Task status in friendly words: "Up next", "In progress", "Done", review states. */
export function StatusChip({ status, reviewStatus, reviewerName, size = 'md', className }: StatusChipProps) {
  const common = { size, className, 'data-status': status } as const;

  if (status === 'upNext') {
    return (
      <Chip tone="grey" icon={Circle} {...common}>
        Up next
      </Chip>
    );
  }

  if (status === 'inProgress') {
    return (
      <Chip tone="lavender" icon={<PulseDot />} {...common}>
        In progress
      </Chip>
    );
  }

  // Done — possibly with a review attached.
  if (reviewStatus === 'pending') {
    return (
      <Chip tone="sky" icon={Send} {...common}>
        {reviewerName ? `Done · sent to ${reviewerName} for review` : 'Done · sent for review'}
      </Chip>
    );
  }
  if (reviewStatus === 'approved') {
    return (
      <Chip tone="mint" {...common}>
        Approved ✓
      </Chip>
    );
  }
  if (reviewStatus === 'changesRequested') {
    return (
      <Chip tone="butter" icon={Sprout} {...common}>
        Changes requested
      </Chip>
    );
  }
  return (
    <Chip tone="mint" icon={Check} {...common}>
      Done
    </Chip>
  );
}
