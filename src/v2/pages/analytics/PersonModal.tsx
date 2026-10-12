// Person profile for managers / founders (opened from People): KPIs and line graph with Daily / Weekly / Monthly + KPI
// filters, where their time goes, task history (resubmits) and the day-by-day track.
import { useMemo, useState } from 'react';
import { Modal } from '@/components';
import { personSeries, personSeriesAll, shiftPeriod, TAG_LABEL, teamTable, type Gran, type Kpi } from '../../analytics';
import { PEOPLE, fmtDay } from '../../data';
import { nameOf, useStore } from '../../store';
import { Avatar, Chip, H2, STATUS } from '../../ui';
import { KpiTrend, WhereTimeGoes } from './charts';
import { GranToggle, KpiPicker, KpiTiles, PeriodSelect, periodNoun, seriesLength, useEarliest, usePeriodOptions, useSlice } from './controls';
import { TaskHistorySummary, TrackTable, resubmitText, useEodOf } from './history';

export function PersonModal({ personId, gran: g0, kpi: k0, index: i0, onClose }: { personId: string | null; gran: Gran; kpi: Kpi; index: number; onClose: () => void }) {
  const person = PEOPLE.find((p) => p.id === personId);
  return (
    <Modal open={!!person} onClose={onClose} size="lg" className="sm:max-w-5xl"
      title={person ? <span className="flex items-center gap-3"><Avatar id={person.id} size="md" /><span>{nameOf(person.id)}<span className="block text-xs font-medium text-muted">{person.title}</span></span></span> : ''}>
      {person && <PersonBody key={person.id} personId={person.id} g0={g0} k0={k0} i0={i0} />}
    </Modal>
  );
}

function PersonBody({ personId, g0, k0, i0 }: { personId: string; g0: Gran; k0: Kpi; i0: number }) {
  const slice = useSlice();
  const tasks = useStore((s) => s.tasks);
  const earliest = useEarliest();
  const [gran, setGran] = useState<Gran>(g0);
  const [kpi, setKpi] = useState<Kpi>(k0);
  const [idx, setIdx] = useState(i0);
  const options = usePeriodOptions(gran, earliest);
  const sel = options[Math.min(idx, options.length - 1)];
  const period = sel.period;
  const prev = shiftPeriod(period, -1);
  const monthsAvail = usePeriodOptions('month', earliest).length;

  const row = useMemo(() => teamTable(slice, gran, period.key).find((r) => r.personId === personId), [slice, gran, period.key, personId]);
  const points = useMemo(() => personSeries(slice, personId, gran, kpi, seriesLength(gran, monthsAvail)), [slice, personId, gran, kpi, monthsAvail]);
  const days = useMemo(() => personSeriesAll(slice, personId, 'day', 20), [slice, personId]);
  const eodOf = useEodOf(personId);
  const current = tasks.filter((t) => t.assigneeId === personId && !t.historic && t.status !== 'done')
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6 pb-2" data-testid="person-modal" data-person={personId}>
      <div className="flex flex-wrap items-center gap-2">
        <GranToggle value={gran} onChange={setGran} />
        <PeriodSelect options={options} index={idx} onChange={setIdx} />
        {row?.tag && (
          <span className="ml-auto flex items-center gap-2 text-xs text-muted" data-testid="person-tag">
            <Chip tone={row.tag === 'acknowledge' ? 'mint' : 'coral'}>{TAG_LABEL[row.tag]}</Chip>
            <span className="max-w-xs">{row.tagReason}</span>
          </span>
        )}
      </div>
      <KpiPicker value={kpi} onChange={setKpi} />

      {row && <KpiTiles cur={row} prev={row.prev} selected={kpi} prevLabel={`Previous ${periodNoun(gran)}: ${prev.title}`} onSelect={setKpi} />}

      <section>
        <H2>Progress over time</H2>
        <KpiTrend points={points} kpi={kpi} selectedKey={period.key} />
        <p className="mt-1 text-[11px] text-muted">{kpi === 'onTime' ? 'Dashed line: 80% goal. ' : ''}Ringed dot: the selected {periodNoun(gran)}. Hollow dot: still in progress.</p>
      </section>

      <section>
        <H2 right={<span className="text-xs text-muted">{period.title}</span>}>Where time goes</H2>
        <WhereTimeGoes personId={personId} from={period.from} to={period.to} />
      </section>

      <section>
        <H2 right={<span className="text-xs text-muted">{period.title}</span>}>Task history</H2>
        <TaskHistorySummary personId={personId} from={period.from} to={period.to} periodTitle={period.title} />
      </section>

      <section>
        <H2 right={<span className="text-xs text-muted">Last 20 working days</span>}>Day-by-day track</H2>
        <TrackTable rows={days} gran="day" selectedKey={gran === 'day' ? period.key : undefined} eodOf={eodOf} />
      </section>

      <section>
        <H2>Current tasks</H2>
        {current.length === 0 ? <p className="text-sm text-muted">No open tasks right now.</p> : (
          <ul className="divide-y divide-line">
            {current.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1"><span className="first-letter:uppercase">{t.title}</span><span className="block text-xs text-muted">{fmtDay(t.date)}</span></span>
                {(t.resubmits ?? 0) > 0 && <Chip tone="butter">{resubmitText(t.resubmits)}</Chip>}
                <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
