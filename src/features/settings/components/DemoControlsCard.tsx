import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Clock, RotateCcw, Sun, Sunset, TimerReset, type LucideIcon } from 'lucide-react';
import { formatClock, useApp, useCurrentUser, useNow } from '@/store';
import { Button, Card, Modal, SectionHeader, toast } from '@/components';
import { ROLE_HOME } from '@/layouts/nav';
import { clearChatLocal } from '@/features/chat/chatLocal';

interface JumpOption {
  label: string;
  icon: LucideIcon;
  run: () => void;
  toastTitle: string;
  emoji: string;
}

/** Simulate time (move the demo clock) and reset the whole demo. */
export function DemoControlsCard() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const now = useNow(10_000);
  const jumpClockTo = useApp((s) => s.jumpClockTo);
  const jumpToEndOfDay = useApp((s) => s.jumpToEndOfDay);
  const resetDemo = useApp((s) => s.resetDemo);
  const setCurrentUser = useApp((s) => s.setCurrentUser);
  const [confirmReset, setConfirmReset] = useState(false);

  const jumps: JumpOption[] = [
    { label: 'Jump to 2pm', icon: Sun, run: () => jumpClockTo(14, 0), toastTitle: 'Demo clock moved to 2:00 pm', emoji: '⏰' },
    {
      label: 'Jump to end of day',
      icon: Sunset,
      run: () => jumpToEndOfDay(),
      toastTitle: 'Fast-forwarded to the end of the day',
      emoji: '🌇',
    },
    { label: 'Back to 11:45', icon: RotateCcw, run: () => jumpClockTo(11, 45), toastTitle: 'Demo clock back to 11:45 am', emoji: '⏪' },
  ];

  const reset = () => {
    const viewer = me;
    resetDemo();
    // Keep viewing as the same person; everything else starts over.
    setCurrentUser(viewer.id);
    clearChatLocal();
    setConfirmReset(false);
    toast({
      title: 'Demo data reset',
      description: 'Fresh start — everything is back to the beginning of the story.',
      emoji: '🌱',
    });
    navigate(ROLE_HOME[viewer.role]);
  };

  return (
    <Card as="section" aria-labelledby="demo-title" className="p-5 sm:p-6" data-testid="demo-card">
      <SectionHeader
        id="demo-title"
        icon={Clock}
        tone="sky"
        title="Demo controls"
        description="Move the demo clock to show escalations, review reminders and the end-of-day wrap-up."
      />

      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-ink">Simulate time</h3>
          <div className="mt-2 flex flex-wrap items-center gap-4 rounded-2xl bg-surface-2 px-4 py-3">
            <div>
              <p className="text-xs text-muted">Demo time</p>
              <p className="text-2xl font-bold tabular-nums text-ink" data-testid="demo-time">
                {formatClock(now.toISOString())}
              </p>
            </div>
            <p className="text-sm text-muted">{format(now, 'EEEE, d MMMM')}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {jumps.map(({ label, icon, run, toastTitle, emoji }) => (
              <Button
                key={label}
                variant="secondary"
                icon={icon}
                onClick={() => {
                  run();
                  toast({ title: toastTitle, tone: 'info', emoji });
                }}
              >
                {label}
              </Button>
            ))}
          </div>
          {me.role === 'resource' && (
            <p className="mt-2 text-xs text-muted">
              "Jump to end of day" also logs your remaining tasks, so the wrap-up moment shows up.
            </p>
          )}
        </div>

        <div className="border-t border-line/70 pt-5">
          <h3 className="text-sm font-semibold text-ink">Reset demo data</h3>
          <p className="mt-1 text-sm text-muted">
            Puts every task, review, feedback report, Spotlight and lounge message back to the start of the story.
          </p>
          <Button className="mt-3" variant="secondary" icon={TimerReset} onClick={() => setConfirmReset(true)}>
            Reset demo data
          </Button>
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        size="sm"
        title="Reset the demo?"
        description="Everything goes back to the starting story: tasks, reviews, feedback, Spotlights, notifications, lounge messages and theme choices."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Keep my changes
            </Button>
            <Button icon={RotateCcw} onClick={reset}>
              Yes, reset
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          You'll stay viewing as {me.firstName}, and the demo clock goes back to 11:45 am.
        </p>
      </Modal>
    </Card>
  );
}
