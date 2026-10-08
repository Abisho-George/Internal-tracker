import { EmptyState, SlideOver } from '@/components';

export interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

/** Placeholder — the feature build replaces this with the anonymous lounge. */
export function ChatPanel({ open, onClose }: ChatPanelProps) {
  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Anonymous lounge"
      description="Nobody, including management, can see who wrote what."
    >
      <EmptyState emoji="🎭" title="Coming together…" description="The lounge is getting comfy. Check back soon." />
    </SlideOver>
  );
}
