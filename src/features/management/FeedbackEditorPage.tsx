import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RefreshCw, Save, Send, Undo2 } from 'lucide-react';
import { formatClock, peopleByRole, personById, suggestFeedback, useApp, useNow, weekStartOf } from '@/store';
import type { Person, WeeklyFeedback } from '@/store/types';
import { Avatar, Button, Card, EmptyState, Modal, Page, toast } from '@/components';
import { BulletSection } from './feedback/BulletSection';
import { FeedbackStatusChip } from './feedback/FeedbackStatusChip';
import { WeekContextCard } from './feedback/WeekContextCard';
import {
  LIST_KEYS,
  LIST_META,
  feedbackIdFor,
  fromDraft,
  sharedOnLabel,
  toDraft,
  useAppData,
  weekOfLabel,
  workWeekRange,
  type DraftLists,
  type ListKey,
} from './feedback/feedbackModel';

const AUTOSAVE_MS = 700;

/** Weekly feedback editor for one resource: shine / improve / next steps, then Send. */
export default function FeedbackEditorPage() {
  const { personId = '' } = useParams();
  const data = useAppData();
  const saveFeedback = useApp((s) => s.saveFeedback);
  const person = personById(data.people, personId);
  const weekStart = weekStartOf(data.demoDate);
  const feedback = data.weeklyFeedback.find((f) => f.personId === personId && f.weekStart === weekStart);
  const isResource = person?.role === 'resource';

  // No report for this week yet: start one from the suggestions.
  useEffect(() => {
    if (!person || !isResource || feedback) return;
    const s = suggestFeedback(data, person.id, weekStart);
    saveFeedback({ id: feedbackIdFor(person.id, weekStart), personId: person.id, weekStart, ...s, status: 'draft' });
  }, [person, isResource, feedback, data, weekStart, saveFeedback]);

  if (!person || !isResource) {
    return (
      <Page title="Weekly feedback">
        <Card>
          <EmptyState
            emoji="🧭"
            title="We couldn't find that report"
            description="Weekly feedback is written for the resources on the team. Pick someone from the list."
            action={
              <Link
                to="/feedback"
                className="focus-ring inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-on"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden /> Back to weekly feedback
              </Link>
            }
          />
        </Card>
      </Page>
    );
  }

  if (!feedback) {
    return <Page title={`Feedback for ${person.name}`} eyebrow={weekOfLabel(weekStart)} />;
  }

  return <FeedbackEditor key={feedback.id} feedback={feedback} person={person} weekStart={weekStart} />;
}

interface FeedbackEditorProps {
  feedback: WeeklyFeedback;
  person: Person;
  weekStart: string;
}

function FeedbackEditor({ feedback, person, weekStart }: FeedbackEditorProps) {
  const data = useAppData();
  const navigate = useNavigate();
  const now = useNow(30_000);
  const saveFeedback = useApp((s) => s.saveFeedback);
  const sendFeedback = useApp((s) => s.sendFeedback);

  const [lists, setLists] = useState<DraftLists>(() => toDraft(feedback));
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  // Bumped when the lists are replaced wholesale, so rows swap without exit animations.
  const [generation, setGeneration] = useState(0);
  const isSent = feedback.status === 'sent';

  // Latest values for callbacks that run later (autosave, unmount flush).
  const latest = useRef({ lists, dirty, feedback });
  latest.current = { lists, dirty, feedback };

  const persist = useCallback(
    (quiet: boolean) => {
      const { lists: l, feedback: f } = latest.current;
      saveFeedback({ ...f, ...fromDraft(l) });
      setDirty(false);
      setSavedAt(new Date().toISOString());
      if (!quiet) {
        toast({ title: 'Draft saved', description: 'It stays private until you send it.', emoji: '📝' });
      }
    },
    [saveFeedback],
  );

  // Drafts save themselves shortly after each change (and on blur).
  useEffect(() => {
    if (!dirty || isSent) return;
    const t = window.setTimeout(() => persist(true), AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [lists, dirty, isSent, persist]);

  // Leaving the page with pending draft edits: save them.
  useEffect(
    () => () => {
      const { dirty: d, feedback: f, lists: l } = latest.current;
      if (d && f.status === 'draft') saveFeedback({ ...f, ...fromDraft(l) });
    },
    [saveFeedback],
  );

  const setList = (key: ListKey, bullets: DraftLists[ListKey]) => {
    setLists((prev) => ({ ...prev, [key]: bullets }));
    setDirty(true);
  };

  const commitOnBlur = () => {
    if (latest.current.dirty && latest.current.feedback.status === 'draft') persist(true);
  };

  const payload = fromDraft(lists);
  const canSend = payload.shine.length > 0;

  const send = () => {
    if (!canSend) return;
    const wasSent = isSent;
    saveFeedback({ ...feedback, ...payload });
    sendFeedback(feedback.id);
    setLists(toDraft(payload));
    setGeneration((g) => g + 1);
    setDirty(false);
    setSavedAt(null);
    toast({
      title: `Shared with ${person.firstName}`,
      description: wasSent
        ? `The updated report is in ${person.firstName}'s My Progress.`
        : `It's waiting in ${person.firstName}'s My Progress.`,
      emoji: '💌',
    });
  };

  const discard = () => {
    setLists(toDraft(feedback));
    setGeneration((g) => g + 1);
    setDirty(false);
    toast({ title: 'Changes discarded', description: 'Back to the report as it was shared.', tone: 'info', emoji: '↩️' });
  };

  const refresh = () => {
    const s = suggestFeedback(data, person.id, weekStart);
    setLists(toDraft(s));
    setGeneration((g) => g + 1);
    setDirty(true);
    setConfirmRefresh(false);
    toast({
      title: 'Fresh suggestions pulled in',
      description: `Based on ${person.firstName}'s week so far.`,
      tone: 'info',
      emoji: '🔄',
    });
  };

  // Alphabetical "next person" for a smooth writing session (not a ranking).
  const nextPerson = useMemo(() => {
    const team = peopleByRole(data.people, 'resource');
    const i = team.findIndex((p) => p.id === person.id);
    return team.length > 1 ? team[(i + 1) % team.length] : undefined;
  }, [data.people, person.id]);

  let statusLine: string;
  if (isSent) {
    if (dirty) statusLine = 'Unsaved changes — resend to share them';
    else statusLine = feedback.sentAt ? `Shared ${sharedOnLabel(feedback.sentAt, now)}` : 'Shared';
  } else if (dirty) statusLine = 'Saving…';
  else statusLine = savedAt ? `Draft saved · ${formatClock(savedAt)}` : 'Draft · saves automatically';

  return (
    <Page
      documentTitle={`Feedback for ${person.firstName}`}
      eyebrow={
        <span className="inline-flex flex-wrap items-center gap-2">
          <Link
            to="/feedback"
            className="focus-ring inline-flex items-center gap-1 rounded-md font-semibold text-accent-ink hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Weekly feedback
          </Link>
          <span aria-hidden>·</span>
          <span>
            {weekOfLabel(weekStart)} ({workWeekRange(weekStart)})
          </span>
        </span>
      }
      title={
        <span className="inline-flex items-center gap-3">
          <Avatar person={person} size="lg" decorative />
          <span>Feedback for {person.name}</span>
        </span>
      }
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <FeedbackStatusChip status={feedback.status} />
          <span data-testid="save-state">{statusLine}</span>
        </span>
      }
      actions={
        <>
          <Button variant="secondary" icon={RefreshCw} onClick={() => setConfirmRefresh(true)}>
            Refresh suggestions
          </Button>
          {nextPerson && (
            <Button variant="ghost" iconRight={ArrowRight} onClick={() => navigate(`/feedback/${nextPerson.id}`)}>
              Next: {nextPerson.firstName}
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          {LIST_KEYS.map((key) => (
            <BulletSection
              key={`${key}-${generation}`}
              sectionId={key}
              meta={LIST_META[key]}
              bullets={lists[key]}
              onChange={(b) => setList(key, b)}
              onCommit={commitOnBlur}
            />
          ))}

          {/* Sticky action bar so Send is always within reach. */}
          <div className="sticky bottom-4 z-10">
            <Card className="flex flex-wrap items-center gap-3 border-line p-4 shadow-lift" data-testid="feedback-actions">
              <p className="min-w-[12rem] flex-1 text-sm text-muted">
                {!canSend ? (
                  <>Add at least one area where {person.firstName} shone to send.</>
                ) : isSent ? (
                  <>
                    Already shared with {person.firstName}. Edits stay here until you{' '}
                    <strong className="text-ink">update &amp; resend</strong>.
                  </>
                ) : (
                  <>
                    {person.firstName} gets a friendly notification and finds it in{' '}
                    <strong className="text-ink">My Progress</strong>.
                  </>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {isSent ? (
                  dirty && (
                    <Button variant="ghost" icon={Undo2} onClick={discard}>
                      Discard changes
                    </Button>
                  )
                ) : (
                  <Button variant="secondary" icon={Save} onClick={() => persist(false)}>
                    Save draft
                  </Button>
                )}
                <Button icon={Send} onClick={send} disabled={!canSend || (isSent && !dirty)}>
                  {isSent ? 'Update & resend' : `Send to ${person.firstName}`}
                </Button>
              </div>
            </Card>
          </div>
        </div>

        <aside className="order-first min-w-0 xl:order-none" aria-label={`${person.firstName}'s week`}>
          <div className="xl:sticky xl:top-24">
            <WeekContextCard data={data} person={person} weekStart={weekStart} />
          </div>
        </aside>
      </div>

      <Modal
        open={confirmRefresh}
        onClose={() => setConfirmRefresh(false)}
        size="sm"
        title="Refresh suggestions?"
        description={`This swaps the bullets for fresh suggestions from ${person.firstName}'s week. Your edits here will be replaced.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRefresh(false)}>
              Keep my edits
            </Button>
            <Button icon={RefreshCw} onClick={refresh}>
              Refresh
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Suggestions come from {person.firstName}'s own week: logging, ratings, daily notes and reviews.
        </p>
      </Modal>
    </Page>
  );
}
