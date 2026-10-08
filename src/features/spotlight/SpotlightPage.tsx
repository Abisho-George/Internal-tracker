import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { History, PenLine, Sparkles, Star } from 'lucide-react';
import { monthKey, personById, projectById, useCurrentUser } from '@/store';
import { Avatar, Button, Card, EmptyState, Page, SectionHeader, TONE_TEXT, celebrate, cn } from '@/components';
import { SpotlightCard } from './components/SpotlightCard';
import { SpotlightTimeline } from './components/SpotlightTimeline';
import { clearJustPublished, isJustPublished } from './session';
import {
  monthLabel,
  monthName,
  personHighlights,
  pmHighlights,
  projectHighlights,
  publishedLabel,
  sortSpotlights,
  useAppData,
} from './spotlightStats';

/** Spotlight page (everyone): this month's three Spotlights + a timeline of past months. */
export default function SpotlightPage() {
  const data = useAppData();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const isManagement = me.role === 'management';

  const currentMonth = monthKey(data.demoDate);
  const sorted = useMemo(() => sortSpotlights(data.spotlights), [data.spotlights]);
  const featured = sorted[0];
  const past = sorted.slice(1);
  const currentPublished = featured?.month === currentMonth;

  // The flourish plays once, right after publishing in this session.
  const [celebrating] = useState(() => !!featured && isJustPublished(featured.month));
  useEffect(() => {
    if (!celebrating) return;
    clearJustPublished();
    const t = window.setTimeout(() => celebrate({ sides: true, particleCount: 120 }), 420);
    return () => window.clearTimeout(t);
  }, [celebrating]);

  const cards = useMemo(() => {
    if (!featured) return null;
    const person = personById(data.people, featured.personId);
    const pm = personById(data.people, featured.pmId);
    const project = projectById(data.projects, featured.projectId);
    const projectPm = personById(data.people, project?.pmId);
    return {
      person,
      pm,
      project,
      projectPm,
      personStats: personHighlights(data, featured.personId, featured.month),
      pmStats: pmHighlights(data, featured.pmId, featured.month),
      projectStats: projectHighlights(data, featured.projectId, featured.month),
    };
  }, [data, featured]);

  const pickButton = isManagement ? (
    <Button icon={currentPublished ? PenLine : Sparkles} onClick={() => navigate('/spotlights/manage')} variant={currentPublished ? 'secondary' : 'primary'}>
      {currentPublished ? "Edit this month's picks" : "Pick this month's Spotlights"}
    </Button>
  ) : undefined;

  return (
    <Page
      title="Spotlight"
      subtitle="Three monthly Spotlights, celebrated by everyone ✨"
      actions={pickButton}
    >
      {!featured || !cards ? (
        <Card>
          <EmptyState
            emoji="✨"
            title={`${monthName(currentMonth)}'s Spotlights are being picked ✨`}
            description="The very first Spotlights will appear here soon."
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {!currentPublished && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3 rounded-card border border-lavender-strong/30 bg-lavender-soft px-5 py-4 sm:flex-row sm:items-center"
              data-testid="spotlight-banner"
              role="status"
            >
              <span aria-hidden className="text-2xl">
                🗳️
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-lavender-ink">{monthName(currentMonth)}'s Spotlights are being picked ✨</p>
                <p className="text-sm text-ink/80">
                  Meanwhile, here's a look back at {monthName(featured.month)}'s wonderful three.
                </p>
              </div>
            </motion.div>
          )}

          <section aria-labelledby="spotlight-featured">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="spotlight-featured" className="flex items-center gap-2 text-lg font-bold">
                  <Star className={cn('h-5 w-5', TONE_TEXT.butter)} aria-hidden />
                  {monthLabel(featured.month)}
                </h2>
                <p className="text-sm text-muted">Published {publishedLabel(featured.publishedAt)}</p>
              </div>
            </div>

            <motion.div
              className="grid gap-5 lg:grid-cols-3"
              initial={reduce ? false : 'hidden'}
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: celebrating ? 0.18 : 0.09 } } }}
            >
              <SpotlightCard
                kind="person"
                monthText={monthLabel(featured.month)}
                celebrating={celebrating}
                name={cards.person?.name ?? 'A teammate'}
                subtitle={cards.person?.title}
                visual={cards.person ? <Avatar person={cards.person} size="xl" decorative /> : <span className="text-4xl">🌟</span>}
                citation={featured.citations.person}
                highlights={cards.personStats}
              />
              <SpotlightCard
                kind="pm"
                monthText={monthLabel(featured.month)}
                celebrating={celebrating}
                name={cards.pm?.name ?? 'A project manager'}
                subtitle={cards.pm?.title}
                visual={cards.pm ? <Avatar person={cards.pm} size="xl" decorative /> : <span className="text-4xl">🧭</span>}
                citation={featured.citations.pm}
                highlights={cards.pmStats}
              />
              <SpotlightCard
                kind="project"
                monthText={monthLabel(featured.month)}
                celebrating={celebrating}
                name={cards.project?.name ?? 'A project'}
                subtitle={
                  cards.project && (
                    <span>
                      {cards.project.client} · {cards.project.geography}
                      {cards.projectPm && ` · PM ${cards.projectPm.firstName}`}
                    </span>
                  )
                }
                visual={
                  <span
                    aria-hidden
                    className={cn(
                      'inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface text-2xl font-bold',
                      cards.project ? TONE_TEXT[cards.project.color] : 'text-ink',
                    )}
                  >
                    {cards.project?.client.slice(0, 1) ?? '🚀'}
                  </span>
                }
                citation={featured.citations.project}
                highlights={cards.projectStats}
              />
            </motion.div>
          </section>

          <section aria-labelledby="spotlight-past">
            <SectionHeader
              id="spotlight-past"
              icon={History}
              tone="lavender"
              title="Past Spotlights"
              description="Every month's three, newest first."
            />
            {past.length === 0 ? (
              <Card>
                <EmptyState compact emoji="🌱" title="This is the very first Spotlight month" description="Past months will line up here." />
              </Card>
            ) : (
              <SpotlightTimeline spotlights={past} people={data.people} projects={data.projects} />
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
