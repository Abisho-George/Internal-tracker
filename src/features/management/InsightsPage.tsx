import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Briefcase, CalendarRange, FolderKanban, UserRound } from 'lucide-react';
import { Avatar, Card, Page, SegmentedControl, TONE_STRONG_BG, cn } from '@/components';
import { peopleByRole } from '@/store';
import { EntityPicker, type EntityOption } from './insights/EntityPicker';
import { PersonInsights } from './insights/PersonInsights';
import { PmInsights } from './insights/PmInsights';
import { ProjectInsights } from './insights/ProjectInsights';
import { RANGE_OPTIONS, availableWeeks, resolveRange, useAppData, type RangeKey } from './insights/shared';

type Tab = 'project' | 'person' | 'pm';

const TAB_OPTIONS = [
  { value: 'project' as const, label: 'By Project', icon: FolderKanban },
  { value: 'person' as const, label: 'By Person', icon: UserRound },
  { value: 'pm' as const, label: 'By PM', icon: Briefcase },
];

const PICKER_LABEL: Record<Tab, string> = {
  project: 'Pick a project',
  person: 'Pick a person',
  pm: 'Pick a project manager',
};

const isTab = (v: string | null): v is Tab => v === 'project' || v === 'person' || v === 'pm';
const isRange = (v: string | null): v is RangeKey => v === '4w' || v === '8w' || v === 'quarter';

/**
 * Insights explorer (spec §8.3 B). One project, person or PM at a time, each
 * compared only with its own history. Supports `?tab=person|project|pm&id=<id>`
 * (and `&range=4w|8w|quarter`).
 */
export default function InsightsPage() {
  const data = useAppData();
  const reduce = useReducedMotion();
  const [params, setParams] = useSearchParams();

  const tabParam = params.get('tab');
  const rangeParam = params.get('range');
  const tab: Tab = isTab(tabParam) ? tabParam : 'project';
  const rangeKey: RangeKey = isRange(rangeParam) ? rangeParam : '8w';

  const options = useMemo<Record<Tab, EntityOption[]>>(() => {
    const projects = [...data.projects].sort((a, b) => a.name.localeCompare(b.name));
    return {
      project: projects.map((p) => ({
        id: p.id,
        label: p.name,
        leading: <span aria-hidden className={cn('ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TONE_STRONG_BG[p.color])} />,
      })),
      person: peopleByRole(data.people, 'resource').map((p) => ({
        id: p.id,
        label: p.name,
        leading: <Avatar person={p} size="xs" decorative />,
      })),
      pm: peopleByRole(data.people, 'pm').map((p) => ({
        id: p.id,
        label: p.name,
        leading: <Avatar person={p} size="xs" decorative />,
      })),
    };
  }, [data.projects, data.people]);

  const list = options[tab];
  const idParam = params.get('id');
  const id = idParam && list.some((o) => o.id === idParam) ? idParam : (list[0]?.id ?? '');

  // Remember the last pick per tab, so switching tabs back and forth keeps it.
  const lastPick = useRef<Partial<Record<Tab, string>>>({});
  lastPick.current[tab] = id;

  const available = useMemo(() => availableWeeks(data), [data]);
  const range = useMemo(() => resolveRange(rangeKey, data.demoDate, available), [rangeKey, data.demoDate, available]);

  const update = (next: { tab?: Tab; id?: string; range?: RangeKey }) => {
    const t = next.tab ?? tab;
    const nextId = next.id ?? (t !== tab ? (lastPick.current[t] ?? options[t][0]?.id ?? '') : id);
    const search = new URLSearchParams({ tab: t, id: nextId });
    const r = next.range ?? rangeKey;
    if (r !== '8w') search.set('range', r);
    setParams(search, { replace: true });
  };

  return (
    <Page
      title="Insights"
      subtitle="Trends over time — one project, person or PM at a time, each compared only with its own history."
    >
      <Card className="mb-6 space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedControl ariaLabel="Insights view" options={TAB_OPTIONS} value={tab} onChange={(t) => update({ tab: t })} />
          <SegmentedControl
            ariaLabel="Date range"
            options={RANGE_OPTIONS}
            value={rangeKey}
            onChange={(r) => update({ range: r })}
            size="sm"
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted" aria-hidden>
            {PICKER_LABEL[tab]} <span className="font-medium normal-case tracking-normal text-faint">· one at a time</span>
          </p>
          {list.length === 0 ? (
            <p className="text-sm text-muted">Nothing to pick yet.</p>
          ) : (
            <EntityPicker ariaLabel={PICKER_LABEL[tab]} options={list} value={id} onChange={(next) => update({ id: next })} />
          )}
        </div>
        <p className="flex items-start gap-2 text-xs text-muted" data-testid="range-hint" aria-live="polite">
          <CalendarRange className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{range.hint}</span>
        </p>
      </Card>

      <motion.div
        key={`${tab}:${id}`}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      >
        {id && tab === 'person' && <PersonInsights data={data} personId={id} range={range} />}
        {id && tab === 'project' && <ProjectInsights data={data} projectId={id} range={range} />}
        {id && tab === 'pm' && <PmInsights data={data} pmId={id} range={range} />}
      </motion.div>
    </Page>
  );
}
