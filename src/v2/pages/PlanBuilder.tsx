import { useMemo, useState, type DragEvent } from 'react';
import { CalendarClock, Copy, GripVertical, Plus, Trash2, Wand2 } from 'lucide-react';
import { toast } from '@/components';
import { previousWorkingDay, toMinutes } from '../data';
import { defaultPlan, LUNCH, useStore, type DayBlock, type ExtraHours } from '../store';
import { Btn, cx, fmtMin } from '../ui';
import { colorOf } from './Widgets';
import { DurationInput } from './DailyViews';

const DAY_START = 10 * 60;
const DAY_END = 19 * 60;
const L0 = toMinutes(LUNCH.start);
const L1 = toMinutes(LUNCH.end);
const OTHER = 'other:';
const CUSTOM = '__custom';
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
let seq = 0;

/** One block in the plan: a project (or a typed name) and how long. Times come from its place in the order. */
export interface PlanItem { id: string; projectId: string; minutes: number; actual?: number; custom?: DayBlock['custom'] }

/** Saved blocks back into an ordered list (blocks split around lunch join up again). */
export function toItems(plan: DayBlock[]): PlanItem[] {
  const out = new Map<string, PlanItem>();
  [...plan].sort((a, b) => a.start.localeCompare(b.start)).forEach((b) => {
    const id = b.id.split('~')[0];
    const m = Math.max(0, toMinutes(b.end) - toMinutes(b.start));
    const cur = out.get(id);
    if (cur) { cur.minutes += m; if (b.actualMinutes != null) cur.actual = (cur.actual ?? 0) + b.actualMinutes; }
    else out.set(id, { id, projectId: b.projectId, minutes: m, actual: b.actualMinutes, custom: b.custom });
  });
  return [...out.values()];
}

/** Lay the blocks out from 10am one after another, skipping lunch: a block that reaches 1pm carries on at 2pm. */
export function toPlan(items: PlanItem[]): DayBlock[] {
  const out: DayBlock[] = [];
  let cur = DAY_START;
  items.forEach((it) => {
    let left = it.minutes;
    const parts: { s: number; e: number }[] = [];
    while (left > 0) {
      if (cur >= L0 && cur < L1) cur = L1;
      const end = cur < L0 && cur + left > L0 ? L0 : cur + left;
      parts.push({ s: cur, e: end });
      left -= end - cur;
      cur = end;
    }
    parts.forEach((p, i) => {
      const share = it.actual != null ? Math.round((it.actual * (p.e - p.s)) / it.minutes) : undefined;
      out.push({ id: i ? `${it.id}~${i + 1}` : it.id, start: clock(p.s), end: clock(p.e), projectId: it.projectId, taskIds: [], custom: it.custom, actualMinutes: share });
    });
  });
  return out;
}

const nameOf = (projectId: string, custom: DayBlock['custom'], projects: { id: string; name: string }[]) =>
  custom ? custom.title : projectId.startsWith(OTHER) ? projectId.slice(OTHER.length) : projects.find((p) => p.id === projectId)?.name ?? 'Project';

/**
 * Plan your day in two steps: pick a project (any ongoing project in the company, or type one) and how long.
 * Blocks line up from 10am around lunch; drag them along the line to reorder, or onto the bin to remove.
 */
export function PlanBuilder({ plan, setPlan, extra, personId, date }: { plan: DayBlock[]; setPlan: (p: DayBlock[]) => void; extra: ExtraHours[]; personId: string; date: string }) {
  const { projects, daily } = useStore();
  const active = projects.filter((p) => p.status === 'active');
  const items = useMemo(() => toItems(plan), [plan]);
  const laid = useMemo(() => toPlan(items), [items]);
  const [pid, setPid] = useState(active[0]?.id ?? '');
  const [customName, setCustomName] = useState('');
  const [mins, setMins] = useState<number | undefined>(60);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const total = items.reduce((a, i) => a + i.minutes, 0);
  const endAt = laid.length ? toMinutes(laid[laid.length - 1].end) : DAY_START;
  const span = Math.max(DAY_END, endAt) - DAY_START;
  const pos = (m: number) => `${((m - DAY_START) / span) * 100}%`;
  const commit = (next: PlanItem[]) => setPlan(toPlan(next));

  const add = () => {
    const name = customName.trim();
    if (pid === CUSTOM && !name) { toast({ title: 'Type the project name', tone: 'error' }); return; }
    if (!mins || mins < 5) { toast({ title: 'Type how long, e.g. 1h 30m', tone: 'error' }); return; }
    commit([...items, { id: `pb${Date.now().toString(36)}${++seq}`, projectId: pid === CUSTOM ? `${OTHER}${name}` : pid, minutes: mins }]);
    setCustomName('');
  };
  const move = (id: string, beforeId: string | null) => {
    if (id === beforeId) return;
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const rest = items.filter((x) => x.id !== id);
    const at = beforeId ? rest.findIndex((x) => x.id === beforeId) : rest.length;
    rest.splice(at < 0 ? rest.length : at, 0, it);
    commit(rest);
  };
  const remove = (id: string) => commit(items.filter((x) => x.id !== id));
  const fillYesterday = () => {
    const prev = daily[`${personId}|${previousWorkingDay(date)}`]?.plan ?? [];
    if (!prev.length) { toast({ title: 'No plan saved on the previous working day', tone: 'info' }); return; }
    commit(toItems(prev).map((x) => ({ ...x, id: `pb${Date.now().toString(36)}${++seq}`, actual: undefined })));
    toast({ title: 'Copied the previous day\'s blocks. Save to keep them.', tone: 'success' });
  };
  const onDrop = (e: DragEvent, beforeId: string | null) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || drag;
    if (id) move(id, beforeId);
    setDrag(null); setOver(null);
  };
  /** Dropping on the right half of a block puts the dragged one after it. */
  const targetFor = (e: DragEvent, id: string) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX < r.left + r.width / 2) return id;
    const i = items.findIndex((x) => x.id === id);
    return items[i + 1]?.id ?? null;
  };
  const extraOnLine = extra.filter((x) => x.start && x.end && x.end > x.start);

  return (
    <div className="space-y-4">
      {/* Step 1 and 2: project and time */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2/60 p-3" aria-label="Add a block">
        <label className="text-xs font-semibold text-muted">Project
          <select aria-label="Block project" className="focus-ring mt-1 block w-56 rounded-xl border border-line bg-surface px-2 py-1.5 text-sm text-ink" value={pid} onChange={(e) => setPid(e.target.value)}>
            {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value={CUSTOM}>Custom (type a name)...</option>
          </select>
        </label>
        {pid === CUSTOM && (
          <label className="text-xs font-semibold text-muted">Name
            <input aria-label="Custom project name" autoFocus className="focus-ring mt-1 block w-48 rounded-xl border border-line bg-surface px-2 py-1.5 text-sm text-ink" placeholder="e.g. Internal training" value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          </label>
        )}
        <label className="text-xs font-semibold text-muted">Time
          <span className="mt-1 block"><DurationInput label="Block time" className="w-24" placeholder="1h 30m" value={mins} onChange={setMins} /></span>
        </label>
        <Btn onClick={add}><Plus size={14} /> Add block</Btn>
        <span className="ml-auto flex flex-wrap gap-2">
          <Btn tone="ghost" className="border border-line bg-surface" onClick={fillYesterday}><Copy size={13} /> Fill from yesterday</Btn>
          <Btn tone="ghost" className="border border-line bg-surface" onClick={() => commit(toItems(defaultPlan(projects, personId)))}><Wand2 size={13} /> From my project hours</Btn>
        </span>
      </div>

      {/* The line */}
      <div>
        <div className="relative h-14 overflow-hidden rounded-xl bg-surface-2" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, null)} data-testid="plan-line">
          <div className="absolute inset-y-0 flex items-center justify-center border-x-2 border-surface bg-grey text-[11px] font-semibold text-grey-ink" style={{ left: pos(L0), width: `${(60 / span) * 100}%`, backgroundImage: 'repeating-linear-gradient(135deg, rgb(0 0 0 / 0.05) 0 6px, transparent 6px 12px)' }} title="Lunch 1pm to 2pm, fixed">🍽 Lunch</div>
          {laid.map((b) => {
            const base = b.id.split('~')[0];
            const s = toMinutes(b.start);
            const e = toMinutes(b.end);
            const color = b.projectId.startsWith(OTHER) || b.custom ? '#64748B' : colorOf(projects, b.projectId);
            return (
              <div key={b.id} draggable data-plan-block={base}
                onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', base); ev.dataTransfer.effectAllowed = 'move'; setDrag(base); }}
                onDragEnd={() => { setDrag(null); setOver(null); }}
                onDragOver={(ev) => { ev.preventDefault(); ev.stopPropagation(); setOver(base); }}
                onDrop={(ev) => { ev.stopPropagation(); onDrop(ev, targetFor(ev, base)); }}
                className={cx('absolute inset-y-0 flex cursor-grab select-none items-center gap-1 truncate border-r-2 border-surface px-2 text-[11px] font-semibold text-white active:cursor-grabbing', drag === base && 'opacity-40', over === base && drag && drag !== base && 'ring-2 ring-inset ring-white')}
                style={{ left: pos(s), width: pos(DAY_START + (e - s)), background: color }} title={`${nameOf(b.projectId, b.custom, projects)} · ${b.start} to ${b.end} · drag to move`}>
                <GripVertical size={12} className="shrink-0 opacity-70" />
                <span className="truncate">{nameOf(b.projectId, b.custom, projects)} · {fmtMin(e - s)}</span>
              </div>
            );
          })}
          {extraOnLine.map((x) => {
            const a = Math.max(DAY_START, toMinutes(x.start!));
            const z = Math.min(DAY_START + span, toMinutes(x.end!));
            if (z <= a) return null;
            return <div key={x.id} data-extra-block className="pointer-events-none absolute bottom-0 h-3 rounded-t bg-lavender-strong" style={{ left: pos(a), width: pos(DAY_START + z - a) }} title={`Extra ${x.start} to ${x.end} · ${x.work}`} />;
          })}
          {!laid.length && <p className="absolute inset-0 flex items-center justify-center text-xs text-muted">Pick a project and a time above, then Add block</p>}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-faint">{Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => <span key={i}>{clock(DAY_START + i * 60).replace(':00', '')}</span>)}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>Planned <b className="text-ink">{fmtMin(total)}</b>{endAt > DAY_END && <span className="ml-1 font-semibold text-coral-ink">· runs past 7pm</span>}</span>
          {extraOnLine.length > 0 && <span><span className="mr-1 inline-block h-2 w-3 rounded bg-lavender-strong align-middle" />Extra hours</span>}
          <span>Drag a block along the line to reorder. Lunch stays fixed and blocks flow around it.</span>
          <div onDragOver={(e) => { e.preventDefault(); setOver('trash'); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; if (id) remove(id); setDrag(null); setOver(null); }}
            data-testid="plan-trash"
            className={cx('ml-auto flex items-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-2 font-semibold transition', over === 'trash' ? 'border-coral-strong bg-coral text-coral-ink' : drag ? 'border-coral-strong/60 text-coral-ink' : 'border-line')}>
            <Trash2 size={14} /> Drop here to delete
          </div>
        </div>
      </div>

      {/* The blocks in order, with the time each one really took */}
      {items.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line" aria-label="Blocks">
          {items.map((it, i) => {
            const parts = laid.filter((b) => b.id.split('~')[0] === it.id);
            return (
              <li key={it.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" data-plan-row={it.id}>
                <span className="w-5 text-xs font-bold text-muted">{i + 1}</span>
                <span className="inline-block h-3 w-3 rounded-full" style={{ background: it.projectId.startsWith(OTHER) || it.custom ? '#64748B' : colorOf(projects, it.projectId) }} />
                <span className="min-w-[10rem] flex-1 font-semibold">{nameOf(it.projectId, it.custom, projects)}
                  <span className="block text-xs font-normal text-muted"><CalendarClock size={11} className="mr-1 inline" />{parts.map((b) => `${b.start} to ${b.end}`).join(', ')}</span>
                </span>
                <label className="flex items-center gap-1 text-xs text-muted">Time
                  <DurationInput label="Planned time" className="w-20" value={it.minutes} onChange={(m) => m && m >= 5 && commit(items.map((x) => (x.id === it.id ? { ...x, minutes: m } : x)))} />
                </label>
                <label className="flex items-center gap-1 text-xs text-muted">Actual
                  <DurationInput label="Actual time" className="w-20" placeholder="..." value={it.actual} onChange={(m) => commit(items.map((x) => (x.id === it.id ? { ...x, actual: m ?? undefined } : x)))} />
                </label>
                <button aria-label="Remove block" className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-coral-ink" onClick={() => remove(it.id)}><Trash2 size={14} /></button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
