import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  addDaysISO,
  loggingStreak,
  parseDate,
  personWeekStats,
  personWeeklySeries,
  useCurrentUser,
  useToday,
  weekStartOf,
} from '@/store';
import type { WeeklyFeedback } from '@/store/types';
import { Page } from '@/components';
import { FeedbackViewModal } from './FeedbackViewModal';
import { FeedbackList } from './components/FeedbackList';
import { RatingMixChart, TimeVsStandardChart } from './components/ProgressCharts';
import { ProgressKpis } from './components/ProgressKpis';
import { StreakCard } from './components/StreakCard';
import { useAppData } from './components/helpers';

/** The resource's own trends — compared only with their own history. */
export default function MyProgressPage() {
  const me = useCurrentUser();
  const today = useToday();
  const data = useAppData();
  const [viewing, setViewing] = useState<{ feedback: WeeklyFeedback; open: boolean }>();

  const stats = useMemo(() => {
    const weekStart = weekStartOf(today);
    const lastWeekStart = addDaysISO(weekStart, -7);
    const sameDayLastWeek = addDaysISO(today, -7);
    return {
      thisWeek: personWeekStats(data, me.id, weekStart),
      lastWeek: personWeekStats(data, me.id, lastWeekStart),
      // Same weekday last week, so a part-week isn't compared with a full one.
      lastWeekToDate: personWeekStats(
        { ...data, tasks: data.tasks.filter((t) => t.date <= sameDayLastWeek) },
        me.id,
        lastWeekStart,
      ),
    };
  }, [data, me.id, today]);

  const series = useMemo(() => personWeeklySeries(data, me.id, 8), [data, me.id]);
  const streak = useMemo(() => loggingStreak(data, me.id), [data, me.id]);
  const feedback = useMemo(
    () =>
      data.weeklyFeedback
        .filter((f) => f.personId === me.id && f.status === 'sent')
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || (b.sentAt ?? '').localeCompare(a.sentAt ?? '')),
    [data.weeklyFeedback, me.id],
  );

  return (
    <Page title="My Progress" subtitle="Your week compared with your own history — nobody else's.">
      <div className="space-y-6">
        <ProgressKpis {...stats} series={series} weekdayLabel={format(parseDate(today), 'EEE')} />

        <StreakCard days={streak} />

        <div className="grid gap-6 xl:grid-cols-2">
          <TimeVsStandardChart series={series} />
          <RatingMixChart series={series} />
        </div>

        <FeedbackList feedback={feedback} people={data.people} onOpen={(f) => setViewing({ feedback: f, open: true })} />
      </div>

      <FeedbackViewModal
        feedback={viewing?.feedback}
        open={!!viewing?.open}
        onClose={() => setViewing((v) => (v ? { ...v, open: false } : v))}
      />
    </Page>
  );
}
