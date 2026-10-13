import { useMemo, useState } from 'react';
import { CalendarRange, Copy, Plus, RotateCcw, Send, Sheet as SheetIcon, Trash2, Undo2, X } from 'lucide-react';
import { toast } from '@/components';
import { addDays, fmtDay, previousWorkingDay, weekStartOf, type Project, type Task } from '../data';
import { emptyDaily, emptySheet, useStore, type DailyUpdate, type Sheet, type SheetRow } from '../store';
import { Btn, Card, Chip, cx, fmtMin } from '../ui';
import { colorOf } from './Widgets';
import { DurationInput, hhmm } from './DailyViews';

export type SheetKind = 'day' | 'week';

/** Key and date range of a daily or weekly sheet. */
export function sheetPeriod(kind: SheetKind, date: string) {
  if (kind === 'day') return { from: date, to: date, key: date, label: fmtDay(date), prev: previousWorkingDay(date) };
  const mon = weekStartOf(date);
  return { from: mon, to: addDays(mon, 4), key: mon, label: `${fmtDay(mon)} to ${fmtDay(addDays(mon, 4))}`, prev: addDays(mon, -7) };
}
export const sheetKey = (personId: string, kind: SheetKind, key: string) => `${personId}|${kind}|${key}`;

type Auto = Required<Pick<SheetRow, 'targets' | 'achieved' | 'notAchieved' | 'completed' | 'estMin' | 'actualMin'>>;
const NONE: Auto = { targets: '', achieved: '', notAchieved: '', completed: false, estMin: 0, actualMin: 0 };
const SUBMITTED = new Set(['in_review', 'done']);
const lines = (xs: string[]) => xs.filter(Boolean).join('\n');

function days(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Everything the app already knows about one project in the period: tasks, plan blocks, numbers and hours. */
export function autoRow(tasks: Task[], project: Project, personId: string, from: string, to: string, daily: Record<string, DailyUpdate>): Auto {
  const mine = tasks.filter((t) => t.assigneeId === personId && t.projectId === project.id && t.date >= from && t.date <= to);
  const ds = days(from, to).map((d) => daily[`${personId}|${d}`] ?? emptyDaily());
  const targets = mine.map((t) => t.title);
  const achieved: string[] = [];
  const notAchieved: string[] = [];
  mine.forEach((t) => {
    const done = SUBMITTED.has(t.status) ? (t.doneQty ?? t.qty) : 0;
    if (done > 0) achieved.push(`${t.title}${done < t.qty ? `: ${done} of ${t.qty} ${t.unit}` : ''}${t.status === 'done' ? ' (approved)' : ''}`);
    if (done < t.qty) notAchieved.push(done ? `${t.title}: ${t.qty - done} ${t.unit} left` : t.title);
  });
  // Custom blocks from the day plan.
  ds.forEach((d) => d.plan.forEach((b) => {
    const c = b.custom;
    if (!c || (c.projectId ?? b.projectId) !== project.id || !c.title.trim()) return;
    targets.push(`${c.title}${c.targetQty ? `: ${c.targetQty} ${c.unit}` : ''}`);
    if (c.achieved) achieved.push(`${c.title}: ${c.achieved} ${c.unit}`);
    if ((c.achieved ?? 0) < c.targetQty) notAchieved.push(`${c.title}: ${c.targetQty - (c.achieved ?? 0)} ${c.unit} left`);
  }));
  // Project numbers (responses, calls, meetings...) added over the period.
  project.metrics.forEach((m) => {
    const t = ds.reduce((a, d) => a + (d.sodTargets[project.id]?.[m.id] ?? 0), 0);
    const a = ds.reduce((x, d) => x + (d.eodActuals[project.id]?.[m.id] ?? 0), 0);
    if (t) targets.push(`${m.label}: ${t}`);
    if (a) achieved.push(`${m.label}: ${a}`);
    if (t && a < t) notAchieved.push(`${m.label}: ${t - a} short`);
  });
  const planned = ds.reduce((a, d) => a + d.plan.filter((b) => b.projectId === project.id && b.actualMinutes != null).reduce((x, b) => x + (b.actualMinutes ?? 0), 0), 0);
  const extra = ds.reduce((a, d) => a + (d.extra ?? []).filter((x) => x.projectId === project.id).reduce((y, x) => y + x.minutes, 0), 0);
  const taskMin = mine.reduce((a, t) => a + (SUBMITTED.has(t.status) ? t.minutes ?? 0 : 0), 0);
  return {
    targets: lines(targets), achieved: lines(achieved), notAchieved: lines(notAchieved),
    completed: targets.length > 0 && notAchieved.length === 0,
    estMin: mine.reduce((a, t) => a + t.targetMinutes, 0),
    actualMin: (planned || taskMin) + extra,
  };
}

/** The rows to show: one per project the person works on (auto-filled) plus saved custom rows, with overrides applied. */
export function useSheetRows(personId: string, kind: SheetKind, date: string) {
  const { tasks, projects, daily, sheets } = useStore();
  const per = sheetPeriod(kind, date);
  const key = sheetKey(personId, kind, per.key);
  const sheet = sheets[key] ?? emptySheet();
  const rows = useMemo(() => {
    const mine = projects.filter((p) => p.status === 'active' && (p.pmId === personId || p.teamIds.includes(personId) || p.admins?.includes(personId) || tasks.some((t) => t.assigneeId === personId && t.projectId === p.id && t.date >= per.from && t.date <= per.to)));
    const saved = new Map(sheet.rows.filter((r) => r.projectId).map((r) => [r.projectId!, r]));
    const projRows = mine.map((p) => {
      const auto = autoRow(tasks, p, personId, per.from, per.to, daily);
      const s = saved.get(p.id) ?? { id: p.id, projectId: p.id };
      return { row: s, auto, name: p.name, color: colorOf(projects, p.id) };
    });
    const custom = sheet.rows.filter((r) => !r.projectId).map((r) => ({ row: r, auto: NONE, name: r.label ?? '', color: '#64748B' }));
    return [...projRows, ...custom];
  }, [tasks, projects, daily, sheet, personId, per.from, per.to]);
  return { per, key, sheet, rows };
}

const val = <K extends keyof Auto>(r: SheetRow, a: Auto, k: K): Auto[K] => (r[k] ?? a[k]) as Auto[K];
/** Enough rows to show wrapped text without scrolling (cells are about 30 characters wide). */
const fitRows = (t: string) => Math.max(2, t.split('\n').reduce((a, l) => a + Math.max(1, Math.ceil(l.length / 28)), 0));
const cell = 'focus-ring w-full resize-y rounded-lg border border-transparent bg-transparent px-2 py-1 text-[13px] leading-snug hover:border-line focus:border-line focus:bg-surface';

function Bullets({ text }: { text: string }) {
  const xs = text.split('\n').map((x) => x.trim()).filter(Boolean);
  if (!xs.length) return <span className="text-muted">·</span>;
  return <ul className="list-disc space-y-0.5 pl-4">{xs.map((x, i) => <li key={i}>{x.replace(/^[•*-]\s*/, '')}</li>)}</ul>;
}

/** Spreadsheet-style daily or weekly update: Project | Targets | Completed | Achieved | Est. time | Not achieved | Actual time. */
export default function UpdateSheet({ personId, kind, date, readOnly }: { personId: string; kind: SheetKind; date: string; readOnly?: boolean }) {
  const { saveSheet, sheets } = useStore();
  const { per, key, sheet, rows } = useSheetRows(personId, kind, date);
  const [newCol, setNewCol] = useState('');
  const what = kind === 'week' ? 'week' : 'day';
  const prevName = kind === 'week' ? 'last week' : 'the previous day';

  const commit = (next: Partial<Sheet>) => saveSheet(key, { ...sheet, ...next });
  const patch = (id: string, projectId: string | undefined, p: Partial<SheetRow>) => {
    const exists = sheet.rows.some((r) => r.id === id);
    commit({ rows: exists ? sheet.rows.map((r) => (r.id === id ? { ...r, ...p } : r)) : [...sheet.rows, { id, projectId, ...p }] });
  };
  const resetRow = (id: string) => commit({ rows: sheet.rows.map((r) => (r.id === id ? { id: r.id, projectId: r.projectId, custom: r.custom } : r)) });
  const addRow = () => commit({ rows: [...sheet.rows, { id: `c${Date.now().toString(36)}`, label: '', targets: '', achieved: '', notAchieved: '', estMin: 0, actualMin: 0, completed: false }] });

  const fillFromPrev = (mode: 'targets' | 'carry') => {
    const prevKey = sheetKey(personId, kind, sheetPeriod(kind, per.prev).key);
    const prev = sheets[prevKey];
    if (!prev?.rows.length && !prev?.cols.length) {
      // Nothing saved last time: fall back to what was auto-filled for that period.
      toast({ title: `Nothing was edited ${prevName}, so the auto-filled rows already match. Edit any cell to change them.`, tone: 'info' });
      return;
    }
    const copied: SheetRow[] = prev.rows.map((r) => {
      const text = mode === 'carry' ? r.notAchieved ?? '' : r.targets ?? '';
      const base = { id: r.projectId ?? `c${Math.random().toString(36).slice(2, 8)}`, projectId: r.projectId, label: r.label, custom: r.custom };
      return r.projectId && !text ? base : { ...base, targets: text, estMin: mode === 'targets' ? r.estMin : undefined };
    });
    const keepIds = new Set(copied.map((r) => r.id));
    commit({ rows: [...sheet.rows.filter((r) => !keepIds.has(r.id)), ...copied], cols: [...new Set([...sheet.cols, ...prev.cols])] });
    toast({ title: mode === 'carry' ? `Carried over what was not achieved ${prevName}` : `Copied targets from ${prevName}`, tone: 'success' });
  };

  const addCol = () => {
    const c = newCol.trim();
    if (!c) return;
    if (sheet.cols.includes(c)) { toast({ title: 'That column already exists', tone: 'error' }); return; }
    commit({ cols: [...sheet.cols, c] });
    setNewCol('');
  };

  const totals = rows.reduce((a, { row, auto }) => ({ est: a.est + val(row, auto, 'estMin'), act: a.act + val(row, auto, 'actualMin'), done: a.done + (val(row, auto, 'completed') ? 1 : 0) }), { est: 0, act: 0, done: 0 });
  const heads = ['Project', 'Targets', 'Completed', 'Targets achieved', 'Estimated time', 'Targets not achieved', 'Actual time taken', ...sheet.cols];

  return (
    <Card className="!p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold">{kind === 'week' ? <CalendarRange size={16} className="text-accent-ink" /> : <SheetIcon size={16} className="text-accent-ink" />}{kind === 'week' ? 'Weekly sheet' : 'Daily sheet'} <span className="font-normal text-muted">· {per.label}</span></p>
          <p className="text-xs text-muted">{readOnly ? 'Targets and how they went, per project.' : `Filled in from your tasks, plan, numbers and hours. Set targets at the start of the ${what}, then it keeps updating. Click any cell to change it.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sheet.at ? <Chip tone="mint">Sent {kind === 'week' ? fmtDay(sheet.at.slice(0, 10)) : hhmm(sheet.at)}</Chip> : <Chip tone="grey">{readOnly ? 'Not sent yet' : 'Saves as you type'}</Chip>}
          {!readOnly && <>
            <Btn tone="ghost" className="border border-line" onClick={() => fillFromPrev('targets')}><Copy size={13} /> Fill from {prevName}</Btn>
            <Btn tone="ghost" className="border border-line" onClick={() => fillFromPrev('carry')}><Undo2 size={13} /> Carry over not achieved</Btn>
          </>}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm" aria-label={`${kind === 'week' ? 'Weekly' : 'Daily'} update sheet`}>
          <thead>
            <tr className="bg-surface-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              {heads.map((h, i) => (
                <th key={h} className={cx('border-b border-line px-2 py-2', i === 2 && 'w-20 text-center', (i === 4 || i === 6) && 'w-28')}>
                  <span className="flex items-center gap-1">{h}
                    {i >= 7 && !readOnly && <button aria-label={`Remove column ${h}`} className="focus-ring rounded p-0.5 hover:text-coral-ink" onClick={() => commit({ cols: sheet.cols.filter((c) => c !== h) })}><X size={11} /></button>}
                  </span>
                </th>
              ))}
              {!readOnly && <th className="w-16 border-b border-line" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={heads.length + 1} className="px-4 py-6 text-center text-muted">No projects yet. Add a custom row for anything you worked on.</td></tr>}
            {rows.map(({ row, auto, name, color }) => {
              const edited = (['targets', 'achieved', 'notAchieved', 'completed', 'estMin', 'actualMin'] as const).some((k) => row[k] !== undefined) && !!row.projectId;
              const text = (k: 'targets' | 'achieved' | 'notAchieved', ph: string) => readOnly
                ? <Bullets text={val(row, auto, k)} />
                : <textarea aria-label={`${name} ${k}`} rows={fitRows(val(row, auto, k))} className={cx(cell, row[k] === undefined && row.projectId && 'text-ink/90')} placeholder={ph}
                    value={val(row, auto, k)} onChange={(e) => patch(row.id, row.projectId, { [k]: e.target.value })} />;
              return (
                <tr key={row.id} data-sheet-row={row.projectId ?? row.id} className="align-top odd:bg-surface even:bg-surface-2/30">
                  <td className="border-b border-line px-2 py-2" style={{ borderLeft: `5px solid ${color}` }}>
                    {row.projectId || readOnly
                      ? <span className="font-semibold">{name || 'Custom'}</span>
                      : <input aria-label="Custom row name" className={cell} placeholder="What else? e.g. Internal" value={row.label ?? ''} onChange={(e) => patch(row.id, undefined, { label: e.target.value })} />}
                    {edited && !readOnly && <span className="mt-1 block text-[10px] text-muted">edited</span>}
                  </td>
                  <td className="border-b border-line px-1 py-1">{text('targets', 'One target per line')}</td>
                  <td className="border-b border-line py-2 text-center">
                    <input type="checkbox" aria-label={`${name} completed`} className="h-4 w-4 accent-[rgb(var(--accent))]" disabled={readOnly}
                      checked={val(row, auto, 'completed')} onChange={(e) => patch(row.id, row.projectId, { completed: e.target.checked })} />
                  </td>
                  <td className="border-b border-line px-1 py-1">{text('achieved', 'What got done')}</td>
                  <td className="border-b border-line px-1 py-1">
                    {readOnly ? <span className="px-1 tabular-nums">{fmtMin(val(row, auto, 'estMin'))}</span>
                      : <DurationInput label={`${name} estimated time`} className="w-24" placeholder="0h" value={val(row, auto, 'estMin') || undefined} onChange={(m) => patch(row.id, row.projectId, { estMin: m ?? 0 })} />}
                  </td>
                  <td className="border-b border-line px-1 py-1">{text('notAchieved', 'What is left and why')}</td>
                  <td className="border-b border-line px-1 py-1">
                    {readOnly ? <span className="px-1 tabular-nums">{fmtMin(val(row, auto, 'actualMin'))}</span>
                      : <DurationInput label={`${name} actual time`} className="w-24" placeholder="0h" value={val(row, auto, 'actualMin') || undefined} onChange={(m) => patch(row.id, row.projectId, { actualMin: m ?? 0 })} />}
                  </td>
                  {sheet.cols.map((c) => (
                    <td key={c} className="border-b border-line px-1 py-1">
                      {readOnly ? <Bullets text={row.custom?.[c] ?? ''} />
                        : <textarea aria-label={`${name} ${c}`} rows={2} className={cell} value={row.custom?.[c] ?? ''} onChange={(e) => patch(row.id, row.projectId, { custom: { ...row.custom, [c]: e.target.value } })} />}
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="border-b border-line px-1 py-2">
                      {row.projectId
                        ? edited && <button aria-label={`Reset ${name} to auto`} title="Back to auto-filled" className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-accent-ink" onClick={() => resetRow(row.id)}><RotateCcw size={14} /></button>
                        : <button aria-label="Remove row" className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => commit({ rows: sheet.rows.filter((r) => r.id !== row.id) })}><Trash2 size={14} /></button>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-surface-2 text-xs font-semibold">
                <td className="px-2 py-2">Total</td><td />
                <td className="text-center tabular-nums">{totals.done}/{rows.length}</td><td />
                <td className="px-2 tabular-nums">{fmtMin(totals.est)}</td><td />
                <td className="px-2 tabular-nums">{fmtMin(totals.act)}</td>
                {sheet.cols.map((c) => <td key={c} />)}{!readOnly && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
          <Btn tone="soft" onClick={addRow}><Plus size={14} /> Add custom row</Btn>
          <span className="flex items-center gap-1">
            <input aria-label="New column name" className="focus-ring w-40 rounded-xl border border-line bg-surface px-2 py-1.5 text-sm" placeholder="New column, e.g. Blockers" value={newCol} onChange={(e) => setNewCol(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCol()} />
            <Btn tone="ghost" className="border border-line" onClick={addCol}><Plus size={13} /> Add column</Btn>
          </span>
          <Btn className="ml-auto" onClick={() => { commit({ at: new Date().toISOString() }); toast({ title: kind === 'week' ? 'Weekly sheet sent 📊' : 'Daily sheet sent 📋', tone: 'success' }); }}>
            <Send size={13} /> {sheet.at ? 'Send again' : `Send ${what} update`}
          </Btn>
        </div>
      )}
    </Card>
  );
}
