import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Sparkles } from 'lucide-react';
import {
  monthKey,
  peopleByRole,
  personById,
  projectById,
  suggestSpotlights,
  useApp,
  type Suggestion,
} from '@/store';
import type { Person, Project, SpotlightCitations } from '@/store/types';
import { Avatar, Button, Card, Chip, Page, TONE_TEXT, celebrate, cn, toast } from '@/components';
import { SpotlightPicker, type PickerOption } from '@/features/spotlight/components/SpotlightPicker';
import { markJustPublished } from '@/features/spotlight/session';
import { monthLabel, monthName, publishedLabel, useAppData } from '@/features/spotlight/spotlightStats';

type Kind = keyof SpotlightCitations;

const capitalise = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function personOption(p: Person): PickerOption {
  return { id: p.id, label: p.name, detail: p.title, visual: <Avatar person={p} size="md" decorative /> };
}

function projectOption(p: Project): PickerOption {
  return {
    id: p.id,
    label: p.name,
    detail: `${p.client} · ${p.geography}`,
    visual: (
      <span
        aria-hidden
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-base font-bold',
          TONE_TEXT[p.color],
        )}
      >
        {p.client.slice(0, 1)}
      </span>
    ),
  };
}

/** A friendly citation when the box is left empty. */
function fallbackCitation(kind: Kind, name: string, suggestion: Suggestion | undefined): string {
  if (suggestion) return `${capitalise(suggestion.reason)}. Thank you, ${name} ✨`;
  return kind === 'project' ? `Thank you to everyone on ${name} for a lovely month ✨` : `Thank you, ${name}, for a lovely month ✨`;
}

/** Management: pick this month's Spotlight Person, PM and Project, then publish. */
export default function ManageSpotlightsPage() {
  const data = useAppData();
  const navigate = useNavigate();
  const publishSpotlight = useApp((s) => s.publishSpotlight);

  const month = monthKey(data.demoDate);
  const existing = data.spotlights.find((s) => s.month === month);
  const publisher = personById(data.people, existing?.publishedById);

  const suggestions = useMemo(() => suggestSpotlights(data, month), [data, month]);
  const resources = useMemo(() => peopleByRole(data.people, 'resource'), [data.people]);
  const pms = useMemo(() => peopleByRole(data.people, 'pm'), [data.people]);
  const projects = useMemo(
    () => data.projects.filter((p) => p.status !== 'done').sort((a, b) => a.name.localeCompare(b.name)),
    [data.projects],
  );

  const [picks, setPicks] = useState<Record<Kind, string | null>>(() => ({
    person: existing?.personId ?? null,
    pm: existing?.pmId ?? null,
    project: existing?.projectId ?? null,
  }));
  const [citations, setCitations] = useState<SpotlightCitations>(
    () => existing?.citations ?? { person: '', pm: '', project: '' },
  );

  const pick = (kind: Kind) => (id: string) => setPicks((p) => ({ ...p, [kind]: id }));
  const cite = (kind: Kind) => (text: string) => setCitations((c) => ({ ...c, [kind]: text }));

  const person = personById(data.people, picks.person ?? undefined);
  const pm = personById(data.people, picks.pm ?? undefined);
  const project = projectById(data.projects, picks.project ?? undefined);
  const ready = !!person && !!pm && !!project;
  const missing = [!person && 'Person', !pm && 'PM', !project && 'Project'].filter(Boolean) as string[];

  const publish = () => {
    if (!person || !pm || !project) return;
    const final: SpotlightCitations = {
      person:
        citations.person.trim() ||
        fallbackCitation('person', person.firstName, suggestions.people.find((s) => s.id === person.id)),
      pm: citations.pm.trim() || fallbackCitation('pm', pm.firstName, suggestions.pms.find((s) => s.id === pm.id)),
      project:
        citations.project.trim() ||
        fallbackCitation('project', project.client, suggestions.projects.find((s) => s.id === project.id)),
    };
    publishSpotlight({ month, personId: person.id, pmId: pm.id, projectId: project.id, citations: final });
    markJustPublished(month);
    celebrate({ particleCount: 90 });
    toast({
      title: `${monthName(month)}'s Spotlights are live`,
      description: `Congratulations ${person.firstName}, ${pm.firstName} and ${project.client}! Everyone has been notified.`,
      tone: 'celebrate',
      emoji: '✨',
    });
    navigate('/spotlight');
  };

  return (
    <Page
      title="Pick Spotlights"
      eyebrow={
        <span className="inline-flex items-center gap-1.5">
          <CalendarCheck className="h-4 w-4" aria-hidden />
          {monthLabel(month)}
        </span>
      }
      subtitle="Three Spotlights each month, shared with everyone. Suggestions come from this month's activity — pick whoever you'd love to celebrate."
    >
      <div className="space-y-6">
        {existing && (
          <div
            role="status"
            data-testid="published-banner"
            className="flex flex-col gap-2 rounded-card border border-mint-strong/40 bg-mint-soft px-5 py-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <span aria-hidden className="text-2xl">
              🎉
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-mint-ink">
                Published on {publishedLabel(existing.publishedAt)}
                {publisher && ` by ${publisher.firstName}`}
              </p>
              <p className="text-sm text-ink/80">You can still tweak the picks or citations and publish the update.</p>
            </div>
          </div>
        )}

        <SpotlightPicker
          kind="person"
          description="Someone on the team who had a lovely month."
          suggestions={suggestions.people}
          options={resources.map(personOption)}
          value={picks.person}
          onChange={pick('person')}
          citation={citations.person}
          onCitationChange={cite('person')}
          citationPlaceholder={`e.g. ${person?.firstName ?? 'Asha'} got quicker week after week and logged every task as it happened.`}
        />
        <SpotlightPicker
          kind="pm"
          description="A project manager who made everyone's days easier."
          suggestions={suggestions.pms}
          options={pms.map(personOption)}
          value={picks.pm}
          onChange={pick('pm')}
          citation={citations.pm}
          onCitationChange={cite('pm')}
          citationPlaceholder={`e.g. ${pm?.firstName ?? 'Meera'} turned reviews around quickly and kept every plan ready before 6 pm.`}
        />
        <SpotlightPicker
          kind="project"
          description="A project with real momentum this month."
          suggestions={suggestions.projects}
          options={projects.map(projectOption)}
          value={picks.project}
          onChange={pick('project')}
          citation={citations.project}
          onCitationChange={cite('project')}
          citationPlaceholder={`e.g. ${project?.client ?? 'Northwind'} hit its L1 message target every week and booked new meetings.`}
        />

        <div className="sticky bottom-4 z-10">
          <Card className="flex flex-wrap items-center gap-3 border-line p-4 shadow-lift" data-testid="publish-bar">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {ready ? (
                <>
                  <Chip tone="mint">{person.name}</Chip>
                  <Chip tone="sky">{pm.name}</Chip>
                  <Chip tone="peach" className="max-w-full">
                    <span className="truncate">{project.name}</span>
                  </Chip>
                </>
              ) : (
                <p className="text-sm text-muted">
                  Still to pick: <strong className="text-ink">{missing.join(', ')}</strong>
                </p>
              )}
            </div>
            <Button icon={Sparkles} onClick={publish} disabled={!ready} size="lg">
              {existing ? 'Publish updates' : `Publish ${monthName(month)}'s Spotlights`}
            </Button>
          </Card>
        </div>
      </div>
    </Page>
  );
}
