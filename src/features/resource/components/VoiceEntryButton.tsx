import { Mic } from 'lucide-react';
import { Tooltip, cn } from '@/components';

const LABEL = 'Voice entry — coming in v2';

/**
 * Spec §8.4 "Voice entry (future)": a mic next to "Add task" that is visibly
 * disabled. It uses aria-disabled (not `disabled`) so it stays focusable and the
 * tooltip still shows on hover and keyboard focus.
 */
export function VoiceEntryButton({ className }: { className?: string }) {
  return (
    <Tooltip content={LABEL} describe={false}>
      <button
        type="button"
        aria-disabled="true"
        aria-label={LABEL}
        data-testid="voice-entry"
        onClick={(e) => e.preventDefault()}
        className={cn(
          'focus-ring inline-flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-dashed border-line bg-surface text-faint',
          className,
        )}
      >
        <Mic className="h-[18px] w-[18px]" aria-hidden />
      </button>
    </Tooltip>
  );
}
