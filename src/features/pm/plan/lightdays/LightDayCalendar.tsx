import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, IconButton, cn } from '@/components';
import { addDaysISO, isWorkingDay, monthKey, parseDate, toISODate, type LightDay } from '@/store';

export interface LightDayCalendarProps {
  today: string;
  lightDays: LightDay[];
  /** Short project labels for a light day ("All projects", "Northwind"). */
  scopeLabel: (ld: LightDay) => string;
  onPick: (date: string) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Month calendar: weekends muted, today ringed, light days in butter with their reason. Arrow keys move. */
export function LightDayCalendar({ today, lightDays, scopeLabel, onPick }: LightDayCalendarProps) {
  const [month, setMonth] = useState(() => monthKey(today));
  const [focused, setFocused] = useState(today);
  const moveFocus = useRef(false);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  const first = parseDate(`${month}-01`);
  const days = useMemo(() => {
    const start = startOfWeek(first, { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(first), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end }).map(toISODate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, LightDay[]>();
    for (const ld of lightDays) {
      const list = map.get(ld.date);
      if (list) list.push(ld);
      else map.set(ld.date, [ld]);
    }
    return map;
  }, [lightDays]);

  // Keep the roving focus inside the visible month.
  const focusInMonth = monthKey(focused) === month ? focused : `${month}-01`;

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    cellRefs.current.get(focusInMonth)?.focus();
  }, [focusInMonth]);

  const shiftMonth = (delta: number) => {
    const next = monthKey(addMonths(first, delta));
    setMonth(next);
    setFocused(monthKey(today) === next ? today : `${next}-01`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, date: string) => {
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let target: string | null = null;
    if (e.key in deltas) target = addDaysISO(date, deltas[e.key]);
    else if (e.key === 'PageUp') target = toISODate(addMonths(parseDate(date), -1));
    else if (e.key === 'PageDown') target = toISODate(addMonths(parseDate(date), 1));
    else if (e.key === 'Home') target = toISODate(startOfWeek(parseDate(date), { weekStartsOn: 1 }));
    else if (e.key === 'End') target = toISODate(endOfWeek(parseDate(date), { weekStartsOn: 1 }));
    if (!target) return;
    e.preventDefault();
    moveFocus.current = true;
    setFocused(target);
    if (monthKey(target) !== month) setMonth(monthKey(target));
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold" aria-live="polite">
          {format(first, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <IconButton label="Previous month" icon={ChevronLeft} size="sm" variant="secondary" onClick={() => shiftMonth(-1)} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setMonth(monthKey(today));
              setFocused(today);
            }}
            disabled={month === monthKey(today)}
          >
            This month
          </Button>
          <IconButton label="Next month" icon={ChevronRight} size="sm" variant="secondary" onClick={() => shiftMonth(1)} />
        </div>
      </div>

      <div role="grid" aria-label={`Light days, ${format(first, 'MMMM yyyy')}`} className="select-none">
        <div role="row" className="mb-1 grid grid-cols-7 gap-1 sm:gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <div role="columnheader" key={d} className={cn('px-1 text-center text-[11px] font-bold uppercase tracking-wide', i > 4 ? 'text-faint' : 'text-muted')}>
              {d}
            </div>
          ))}
        </div>
        {Array.from({ length: days.length / 7 }, (_, w) => (
          <div role="row" key={w} className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {days.slice(w * 7, w * 7 + 7).map((date) => {
              const inMonth = monthKey(date) === month;
              const working = isWorkingDay(date);
              const list = byDate.get(date) ?? [];
              const light = list[0];
              const isToday = date === today;
              const past = date < today;
              const actionable = inMonth && working && (!past || list.length > 0);
              const day = parseDate(date);
              const label = [
                format(day, 'EEEE d MMMM'),
                isToday ? 'today' : '',
                !working ? 'weekend' : '',
                light ? `light day: ${list.map((l) => `${l.reason}, ${l.adjustedTargetPercent}% target, ${scopeLabel(l)}`).join('; ')}` : '',
                actionable && !light ? 'add a light day' : '',
              ]
                .filter(Boolean)
                .join(', ');
              if (!inMonth) {
                return (
                  <div role="gridcell" key={date} aria-hidden className="min-h-[3.25rem] rounded-xl sm:min-h-[5rem]">
                    <span className="block px-2 py-1.5 text-xs text-faint/60">{format(day, 'd')}</span>
                  </div>
                );
              }
              return (
                <div role="gridcell" key={date}>
                  <button
                    ref={(el) => {
                      if (el) cellRefs.current.set(date, el);
                      else cellRefs.current.delete(date);
                    }}
                    type="button"
                    tabIndex={date === focusInMonth ? 0 : -1}
                    aria-label={label}
                    aria-disabled={!actionable || undefined}
                    onClick={() => actionable && onPick(date)}
                    onKeyDown={(e) => onKeyDown(e, date)}
                    onFocus={() => setFocused(date)}
                    data-date={date}
                    className={cn(
                      'focus-ring group relative flex h-full min-h-[3.25rem] w-full flex-col items-start gap-1 overflow-hidden rounded-xl border p-1.5 text-left transition sm:min-h-[5rem] sm:p-2',
                      light
                        ? 'border-butter-strong/70 bg-butter-soft text-butter-ink'
                        : !working
                          ? 'border-transparent bg-surface-2/60 text-faint'
                          : past
                            ? 'border-transparent bg-surface text-faint'
                            : 'border-line/70 bg-surface text-ink',
                      actionable ? 'cursor-pointer hover:-translate-y-px hover:shadow-soft' : 'cursor-default',
                      actionable && !light && 'hover:border-butter-strong/60 hover:bg-butter-soft/40',
                      isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-surface',
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-1">
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold tabular-nums',
                          isToday && 'bg-accent text-accent-on',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {light && (
                        <span className="hidden rounded-full bg-surface/70 px-1.5 text-[10px] font-bold tabular-nums sm:inline">
                          {light.adjustedTargetPercent}%
                        </span>
                      )}
                    </span>
                    {light && (
                      <>
                        <span aria-hidden className="text-sm leading-none sm:hidden">
                          🌤️
                        </span>
                        <span className="line-clamp-2 hidden w-full text-[11px] font-semibold leading-tight sm:block">
                          {light.reason}
                          {list.length > 1 && <span className="font-bold"> +{list.length - 1}</span>}
                        </span>
                      </>
                    )}
                    {actionable && !light && (
                      <span aria-hidden className="mt-auto hidden text-[10px] font-semibold text-faint opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 sm:block">
                        + Light day
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted" aria-label="Legend">
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-md ring-2 ring-accent" /> Today
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-md border border-butter-strong/70 bg-butter-soft" /> Light day
        </li>
        <li className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-md bg-surface-2" /> Weekend
        </li>
      </ul>
    </div>
  );
}
