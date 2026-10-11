import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Modal } from '@/components';
import { useChartColors } from '@/theme/useChartColors';
import { dailyHistory, PEOPLE } from '../data';
import { useStore, nameOf } from '../store';
import { Avatar, Btn, Card, Chip, STATUS, cx } from '../ui';

const avg = (h: number[]) => (h.length ? Math.round(h.reduce((a, b) => a + b, 0) / h.length) : 0);

export default function People() {
  const tasks = useStore((s) => s.tasks);
  const [dir, setDir] = useState<'desc' | 'asc'>('desc');
  const [role, setRole] = useState<'all' | 'resource' | 'pm'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const colors = useChartColors();

  const rows = useMemo(() => {
    return PEOPLE.filter((p) => p.history.length && (role === 'all' || p.role === role))
      .map((p) => {
        const mine = tasks.filter((t) => t.assigneeId === p.id);
        return {
          p,
          eff: p.history[p.history.length - 1],
          change: p.history[p.history.length - 1] - p.history[p.history.length - 2],
          done: mine.filter((t) => t.status === 'done').length,
          review: mine.filter((t) => t.status === 'in_review').length,
          open: mine.filter((t) => t.status !== 'done' && t.status !== 'in_review').length,
        };
      })
      .sort((a, b) => (dir === 'desc' ? b.eff - a.eff : a.eff - b.eff));
  }, [tasks, dir, role]);

  const person = PEOPLE.find((p) => p.id === open);
  const personTasks = tasks.filter((t) => t.assigneeId === open);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">People</h1>
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(['all', 'resource', 'pm'] as const).map((r) => (
            <Btn key={r} tone={r === role ? 'primary' : 'ghost'} className="border border-line" onClick={() => setRole(r)}>
              {r === 'all' ? 'Everyone' : r === 'pm' ? 'Project managers' : 'Resources'}
            </Btn>
          ))}
          <Btn tone="soft" className="ml-auto" onClick={() => setDir((d) => (d === 'desc' ? 'asc' : 'desc'))}>
            Efficiency {dir === 'desc' ? <><ArrowDown size={14} /> high → low</> : <><ArrowUp size={14} /> low → high</>}
          </Btn>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr><th className="py-2">Person</th><th>Efficiency (this week)</th><th>vs last week</th><th>8-wk avg</th><th>Done</th><th>In review</th><th>Open</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.id} className="cursor-pointer border-t border-line hover:bg-surface-2" onClick={() => setOpen(r.p.id)}>
                  <td className="py-2">
                    <button className="focus-ring flex items-center gap-2 rounded-lg text-left" onClick={() => setOpen(r.p.id)}>
                      <Avatar id={r.p.id} size="sm" />
                      <span><span className="font-semibold">{nameOf(r.p.id)}</span><br /><span className="text-xs text-muted">{r.p.title}</span></span>
                    </button>
                  </td>
                  <td className="font-bold">{r.eff}%</td>
                  <td className={cx('font-semibold', r.change >= 0 ? 'text-mint-ink' : 'text-butter-ink')}>{r.change >= 0 ? '+' : ''}{r.change}</td>
                  <td>{avg(r.p.history)}%</td>
                  <td>{r.done}</td><td>{r.review}</td><td>{r.open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!person} onClose={() => setOpen(null)} title={person ? nameOf(person.id) : ''} description={person?.title} size="lg">
        {person && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                ['This week', `${person.history[person.history.length - 1]}%`],
                ['8-week average', `${avg(person.history)}%`],
                ['Tasks done', personTasks.filter((t) => t.status === 'done').length],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl bg-surface-2 p-3">
                  <p className="text-xl font-bold">{v}</p><p className="text-xs text-muted">{l}</p>
                </div>
              ))}
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={dailyHistory(person, 30).map((d) => ({ week: d.date.slice(5), v: d.efficiency }))} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={colors.line} vertical={false} />
                  <XAxis dataKey="week" stroke={colors.muted} fontSize={12} />
                  <YAxis domain={[60, 120]} stroke={colors.muted} fontSize={12} unit="%" />
                  <Tooltip formatter={(v) => [`${v}%`, 'Efficiency']} />
                  <ReferenceLine y={100} stroke={colors.muted} strokeDasharray="4 4" label={{ value: 'Standard', fill: colors.muted, fontSize: 11 }} />
                  <Line type="monotone" dataKey="v" stroke={colors.accent} strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Day-by-day track (last 30 days)</p>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-line">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-left text-xs uppercase text-muted"><tr><th className="px-3 py-2">Date</th><th>Efficiency</th><th>Tasks done</th><th>Hours</th></tr></thead>
                  <tbody>
                    {dailyHistory(person, 30).reverse().map((d) => (
                      <tr key={d.date} className="border-t border-line">
                        <td className="px-3 py-1.5">{new Date(d.date + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                        <td className={cx('font-semibold', d.efficiency >= 100 ? 'text-mint-ink' : 'text-butter-ink')}>{d.efficiency}%</td>
                        <td>{d.tasks}</td><td>{d.hours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">Current tasks</p>
              {personTasks.length === 0 && <p className="text-sm text-muted">No tasks right now.</p>}
              <ul className="divide-y divide-line">
                {personTasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="first-letter:uppercase">{t.title}</span>
                    <Chip tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
