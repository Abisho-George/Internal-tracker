import { format } from 'date-fns';
import { Clock, RotateCcw, Sun, Sunset, type LucideIcon } from 'lucide-react';
import { formatClock, useApp, useNow } from '@/store';
import { Popover, cn, toast } from '@/components';

interface JumpOption {
  label: string;
  icon: LucideIcon;
  run: () => void;
  toastTitle: string;
  emoji: string;
}

/** Top-bar button showing the demo time; opens controls to move the demo clock. */
export function DemoClockMenu() {
  const now = useNow(10_000);
  const jumpClockTo = useApp((s) => s.jumpClockTo);
  const jumpToEndOfDay = useApp((s) => s.jumpToEndOfDay);
  const time = formatClock(now.toISOString());

  const options: JumpOption[] = [
    {
      label: 'Jump to 2pm',
      icon: Sun,
      run: () => jumpClockTo(14, 0),
      toastTitle: 'Demo clock moved to 2:00 pm',
      emoji: '⏰',
    },
    {
      label: 'Jump to end of day',
      icon: Sunset,
      run: () => jumpToEndOfDay(),
      toastTitle: 'Fast-forwarded to the end of the day',
      emoji: '🌇',
    },
    {
      label: 'Back to 11:45',
      icon: RotateCcw,
      run: () => jumpClockTo(11, 45),
      toastTitle: 'Demo clock back to 11:45 am',
      emoji: '⏪',
    },
  ];

  return (
    <Popover
      kind="dialog"
      label="Demo clock"
      align="start"
      panelClassName="w-72 p-3"
      renderTrigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`Demo clock, ${time}`}
          className="focus-ring inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-3 text-sm font-semibold tabular-nums text-ink shadow-soft transition hover:border-faint/50"
        >
          <Clock className="h-4 w-4 text-accent-ink" aria-hidden />
          <span>{time}</span>
        </button>
      )}
    >
      {(close) => (
        <div>
          <div className="px-1 pb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-faint">Demo clock</h2>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{time}</p>
            <p className="text-xs text-muted">{format(now, 'EEEE, d MMMM')}</p>
          </div>
          <div className="space-y-1">
            {options.map(({ label, icon: Icon, run, toastTitle, emoji }) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  run();
                  close();
                  toast({ title: toastTitle, tone: 'info', emoji });
                }}
                className={cn(
                  'focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-ink transition-colors',
                  'hover:bg-accent-soft hover:text-accent-ink focus-visible:bg-accent-soft',
                )}
              >
                <span
                  aria-hidden
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent-ink"
                >
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </button>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
            Advances the demo clock so escalations, reminders and the end-of-day wrap-up can be demoed.
          </p>
        </div>
      )}
    </Popover>
  );
}
