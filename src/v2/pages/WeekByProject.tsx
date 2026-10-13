import { addDays, canManage, fmtDay, inPeriod, TASK_TYPES, weekStartOf, weekTargetFor } from '../data';
import { emptyDaily, useStore } from '../store';
import { Card, fmtMin } from '../ui';
import { colorOf } from './Widgets';
import { WeekPlanner } from './Projects';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * The week, project by project: the project's weekly targets (owners and admins plan them here, and they show
 * in the Projects tab straight away) and every task from the week's daily updates with time and results.
 */
export default function WeekByProject({ personId, date, readOnly }: { personId: string; date: string; readOnly?: boolean }) {
  const { projects, daily } = useStore();
  const mon = weekStartOf(date);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
  const entries = days.flatMap((d) => (daily[`${personId}|${d}`] ?? emptyDaily()).entries?.map((e) => ({ ...e, day: d })) ?? []);
  const mine = projects.filter((p) => p.status === 'active' && (p.pmId === personId || p.teamIds.includes(personId) || p.admins?.includes(personId) || entries.some((e) => e.projectId === p.id)));
  const weekEst = entries.reduce((a, e) => a + e.estMin, 0);
  const weekAct = entries.reduce((a, e) => a + (e.actualMin ?? 0), 0);

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-base font-bold">Weekly targets by project</h2>
          <p className="text-xs text-muted">{fmtDay(mon)} to {fmtDay(addDays(mon, 4))} · targets for each project and the tasks from your daily updates</p>
        </div>
        <p className="text-sm">Week: estimated <b data-testid="week-est">{fmtMin(weekEst)}</b> · actual <b data-testid="week-act">{fmtMin(weekAct)}</b></p>
      </div>
      <div className="space-y-4 p-4">
        {mine.length === 0 && <p className="text-center text-sm text-muted">No projects yet.</p>}
        {mine.map((p) => {
          const rows = entries.filter((e) => e.projectId === p.id);
          const opts = [...TASK_TYPES.map((t) => ({ id: t.id, name: t.name })), ...(p.customStandards ?? []).map((c) => ({ id: `std:${c.id}`, name: c.name }))];
          const name = (task: string, custom?: string) => (task === '__custom' ? custom || 'Custom task' : opts.find((o) => o.id === task)?.name ?? task);
          const target = weekTargetFor(p, date);
          const metrics = p.metrics.filter((m) => inPeriod(m, 'week') && (target[m.id] ?? 0) > 0);
          const est = rows.reduce((a, e) => a + e.estMin, 0);
          const act = rows.reduce((a, e) => a + (e.actualMin ?? 0), 0);
          const plan = !readOnly && canManage(p, personId);
          return (
            <section key={p.id} data-week-project={p.id} className="overflow-hidden rounded-xl border border-line" style={{ borderLeft: `5px solid ${colorOf(projects, p.id)}` }}>
              <div className="flex flex-wrap items-center justify-between gap-2 bg-surface-2/60 px-3 py-2">
                <p className="font-semibold">{p.name}</p>
                <p className="text-xs text-muted">Estimated <b className="text-ink">{fmtMin(est)}</b> · actual <b className="text-ink">{fmtMin(act)}</b></p>
              </div>
              <div className="space-y-3 p-3">
                {plan ? <WeekPlanner p={p} date={date} /> : (
                  <div className="flex flex-wrap gap-1.5" aria-label={`${p.name} weekly targets`}>
                    {metrics.length === 0 ? <span className="text-xs text-muted">No weekly number targets set.</span>
                      : metrics.map((m) => <span key={m.id} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs"><span className="text-muted">{m.label}</span> <b className="tabular-nums">{target[m.id]}</b></span>)}
                  </div>
                )}
                {rows.length === 0 ? <p className="text-xs text-muted">No tasks in this week's daily updates yet.</p> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] text-sm" aria-label={`${p.name} tasks this week`}>
                      <thead><tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                        <th className="w-20 px-2 py-1">Day</th><th className="px-2 py-1">Task</th><th className="w-20 px-2 py-1">Est.</th><th className="w-20 px-2 py-1">Actual</th><th className="px-2 py-1">Achieved</th><th className="px-2 py-1">Remarks</th>
                      </tr></thead>
                      <tbody>
                        {rows.map((e) => (
                          <tr key={e.id} className="border-t border-line align-top">
                            <td className="px-2 py-1 text-muted">{WD[new Date(`${e.day}T12:00:00`).getDay()]} {fmtDay(e.day)}</td>
                            <td className="px-2 py-1"><b>{name(e.task, e.custom)}</b>{e.desc && <span className="block text-xs text-muted">{e.desc}</span>}</td>
                            <td className="px-2 py-1 tabular-nums">{fmtMin(e.estMin)}</td>
                            <td className="px-2 py-1 tabular-nums">{e.actualMin != null ? fmtMin(e.actualMin) : '·'}</td>
                            <td className="px-2 py-1">{e.achieved || '·'}</td><td className="px-2 py-1">{e.remarks || '·'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr className="border-t border-line text-xs font-semibold"><td className="px-2 py-1" colSpan={2}>Total</td><td className="px-2 py-1">{fmtMin(est)}</td><td className="px-2 py-1">{fmtMin(act)}</td><td colSpan={2} /></tr></tfoot>
                    </table>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
