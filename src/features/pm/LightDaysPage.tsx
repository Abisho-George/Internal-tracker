import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { CalendarPlus, CloudSun, Info } from 'lucide-react';
import { Button, Card, Chip, EmptyState, Page, SectionHeader, toast } from '@/components';
import { isWorkingDay, nextWorkingDay, parseDate, useApp, useSettings, useToday, type LightDay, type NewLightDayInput } from '@/store';
import { LightDayCalendar } from './plan/lightdays/LightDayCalendar';
import { LightDayModal, type LightDayModalState } from './plan/lightdays/LightDayModal';
import { friendlyDay, shortDate } from './plan/planShared';

function whenText(date: string, today: string): string {
  const days = differenceInCalendarDays(parseDate(date), parseDate(today));
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

/** Light days (spec §8.2 H): a month calendar for lighter-target days. */
export default function LightDaysPage() {
  const lightDays = useApp((s) => s.lightDays);
  const projects = useApp((s) => s.projects);
  const addLightDay = useApp((s) => s.addLightDay);
  const removeLightDay = useApp((s) => s.removeLightDay);
  const today = useToday();
  const settings = useSettings();
  const workdayMinutes = Math.round(settings.workdayHours * 60);

  const [modal, setModal] = useState<LightDayModalState>(null);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active').sort((a, b) => a.name.localeCompare(b.name)),
    [projects],
  );
  const upcoming = useMemo(
    () => lightDays.filter((ld) => ld.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.reason.localeCompare(b.reason)),
    [lightDays, today],
  );
  const onDate = useMemo(() => (modal ? lightDays.filter((ld) => ld.date === modal.date) : []), [lightDays, modal]);

  const scopeLabel = (ld: LightDay) =>
    ld.projectIds === 'all'
      ? 'All projects'
      : activeProjects
          .filter((p) => (ld.projectIds as string[]).includes(p.id))
          .map((p) => p.client)
          .join(', ') || 'Selected projects';

  const pick = (date: string) => {
    const has = lightDays.some((ld) => ld.date === date);
    setModal({ mode: has ? 'details' : 'add', date });
  };

  const add = (input: NewLightDayInput) => {
    addLightDay(input);
    setModal(null);
    toast({
      title: 'Light day added',
      description: `${friendlyDay(input.date, today)} · ${input.reason} · targets at ${input.adjustedTargetPercent}%`,
      emoji: '🌤️',
    });
  };

  const remove = (ld: LightDay) => {
    removeLightDay(ld.id);
    if (lightDays.filter((x) => x.date === ld.date && x.id !== ld.id).length === 0) setModal(null);
    toast({ title: 'Light day removed', description: `${shortDate(ld.date)} is back to a full day.`, tone: 'info', emoji: '☀️' });
  };

  const firstFree = isWorkingDay(today) ? today : nextWorkingDay(today);

  return (
    <Page
      title="Light days"
      subtitle="Plan lighter days for offsites, festivals or training — targets drop for everyone on those projects."
      actions={
        <Button icon={CalendarPlus} onClick={() => setModal({ mode: 'add', date: firstFree })}>
          Add a light day
        </Button>
      }
    >
      <p className="mb-5 flex items-start gap-2.5 rounded-2xl bg-sky-soft px-4 py-3 text-sm text-sky-ink">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>Light days show on everyone's My Day progress line. Click a working day to add one.</span>
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <LightDayCalendar today={today} lightDays={lightDays} scopeLabel={scopeLabel} onPick={pick} />
        </Card>

        <Card as="aside" aria-labelledby="upcoming-light-days">
          <SectionHeader id="upcoming-light-days" icon={CloudSun} tone="butter" title="Upcoming light days" />
          {upcoming.length === 0 ? (
            <EmptyState compact emoji="☀️" title="No light days coming up" description="Every day is a full one for now." />
          ) : (
            <ul className="space-y-2">
              {upcoming.map((ld) => (
                <li key={ld.id}>
                  <button
                    type="button"
                    onClick={() => setModal({ mode: 'details', date: ld.date })}
                    className="focus-ring flex w-full items-start gap-3 rounded-2xl border border-butter-strong/50 bg-butter-soft/60 p-3 text-left transition hover:-translate-y-px hover:shadow-soft"
                  >
                    <span className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-surface py-1 text-butter-ink">
                      <span className="text-[10px] font-bold uppercase">{format(parseDate(ld.date), 'EEE')}</span>
                      <span className="text-lg font-bold leading-none tabular-nums text-ink">{format(parseDate(ld.date), 'd')}</span>
                      <span className="text-[10px] font-semibold">{format(parseDate(ld.date), 'MMM')}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold leading-snug text-ink">{ld.reason}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Chip size="sm" tone="butter">
                          {ld.adjustedTargetPercent}% target
                        </Chip>
                        <Chip size="sm" tone={ld.projectIds === 'all' ? 'lavender' : 'grey'}>
                          {scopeLabel(ld)}
                        </Chip>
                      </span>
                      <span className="mt-1 block text-xs text-muted">{whenText(ld.date, today)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <LightDayModal
        state={modal}
        onClose={() => setModal(null)}
        existing={onDate}
        projects={activeProjects}
        workdayMinutes={workdayMinutes}
        onAdd={add}
        onRemove={remove}
        onAddAnother={(date) => setModal({ mode: 'add', date })}
      />
    </Page>
  );
}
