import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CalendarClock, Copy, GripVertical, Lock, Plus, Trash2, Unlock, UtensilsCrossed, Wand2 } from 'lucide-react';
import { toast } from '@/components';
import { previousWorkingDay, toMinutes } from '../data';
import { defaultPlan, lunchOf, useStore, type DayBlock, type ExtraHours, type Lunch } from '../store';
import { Btn, cx, fmtMin } from '../ui';
import { colorOf } from './Widgets';
import { DurationInput } from './DailyViews';

const DAY_START = 10 * 60;
const DAY_END = 19 * 60;
const OTHER = 'other:';
const CUSTOM = '__custom';
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const LUNCH_LENGTHS = [30, 45, 60, 75, 90];
const SPRING = { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 } as const;
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

/** Lay the blocks out from 10am one after another, skipping lunch: a block that reaches lunch carries on after it. */
export function toPlan(items: PlanItem[], lunch: Lunch): DayBlock[] {
  const L0 = toMinutes(lunch.start);
  const L1 = toMinutes(lunch.end);
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

const sig = (plan: DayBlock[]) => plan.map((b) => `${b.id}|${b.start}|${b.end}|${b.actualMinutes ?? ''}`).join(',');
const nameOf = (projectId: string, custom: DayBlock['custom'], projects: { id: string; name: string }[]) =>
  custom ? custom.title : projectId.startsWith(OTHER) ? projectId.slice(OTHER.length) : projects.find((p) => p.id === projectId)?.name ?? 'Project';
const colorFor = (projectId: string, custom: DayBlock['custom'], projects: Parameters<typeof colorOf>[0]) =>
  projectId.startsWith(OTHER) || custom ? '#64748B' : colorOf(projects, projectId);

/** Lunch time and length, saved on the person's profile. Locked lunch cannot be changed until unlocked. */
function LunchSetting({ personId, lunch, onChange }: { personId: string; lunch: Lunch; onChange: (l: Lunch) => void }) {
  const setProfile = useStore((s) => s.setProfile);
  const len = toMinutes(lunch.end) - toMinutes(lunch.start);
  const save = (l: Lunch) => { setProfile(personId, { lunch: l }); onChange(l); };
  const setStart = (start: string) => {
    if (!start) return;
    const s = toMinutes(start);
    if (s < DAY_START || s + len > DAY_END) { toast({ title: 'Lunch has to be between 10am and 7pm', tone: 'error' }); return; }
    save({ ...lunch, start, end: clock(s + len) });
  };
  return (
    <div className={cx('flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors', lunch.locked ? 'border-mint-strong/50 bg-mint/30' : 'border-line bg-surface')} aria-label="Lunch time">
      <UtensilsCrossed size={15} className="text-muted" />
      <span className="font-semibold">Lunch</span>
      <input aria-label="Lunch start" type="time" step={900} disabled={lunch.locked} className="focus-ring rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink disabled:opacity-70" value={lunch.start} onChange={(e) => setStart(e.target.value)} />
      <select aria-label="Lunch length" disabled={lunch.locked} className="focus-ring rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink disabled:opacity-70" value={len}
        onChange={(e) => { const n = +e.target.value; const s = toMinutes(lunch.start); if (s + n > DAY_END) return; save({ ...lunch, end: clock(s + n) }); }}>
        {LUNCH_LENGTHS.map((m) => <option key={m} value={m}>{fmtMin(m)}</option>)}
      </select>
      <span className="text-xs text-muted">{lunch.start} to {lunch.end}</span>
      <motion.button whileTap={{ scale: 0.92 }} aria-pressed={!!lunch.locked} onClick={() => { save({ ...lunch, locked: !lunch.locked }); toast({ title: lunch.locked ? 'Lunch unlocked' : 'Lunch locked 🔒', tone: 'success' }); }}
        className={cx('focus-ring ml-auto flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold', lunch.locked ? 'bg-mint-strong text-white' : 'border border-line text-ink hover:bg-surface-2')}>
        {lunch.locked ? <><Lock size={12} /> Locked</> : <><Unlock size={12} /> Lock lunch</>}
      </motion.button>
    </div>
  );
}

/**
 * Plan your day in two steps: pick a project (any ongoing project in the company, or type one) and how long.
 * Blocks line up from 10am around lunch; drag them along the line to reorder (the others slide out of the way
 * while you drag), or onto the bin to remove.
 */
export function PlanBuilder({ plan, setPlan, extra, personId, date }: { plan: DayBlock[]; setPlan: (p: DayBlock[]) => void; extra: ExtraHours[]; personId: string; date: string }) {
  const { projects, daily, profiles } = useStore();
  const reduce = useReducedMotion();
  const [lunch, setLunch] = useState<Lunch>(() => lunchOf(profiles, personId));
  useEffect(() => { setLunch(lunchOf(useStore.getState().profiles, personId)); }, [personId]);
  const L0 = toMinutes(lunch.start);
  const L1 = toMinutes(lunch.end);
  const active = projects.filter((p) => p.status === 'active');
  const items = useMemo(() => toItems(plan), [plan]);
  // Keep the saved plan flowing around this person's lunch (e.g. after the lunch time changes).
  useEffect(() => {
    const laidOut = toPlan(items, lunch);
    if (sig(laidOut) !== sig([...plan].sort((a, b) => a.start.localeCompare(b.start)))) setPlan(laidOut);
  }, [lunch, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const [pid, setPid] = useState(active[0]?.id ?? '');
  const [customName, setCustomName] = useState('');
  const [mins, setMins] = useState<number | undefined>(60);
  /** The block being dragged: where it was grabbed and where its start sits now, in working minutes (lunch left out). */
  const [drag, setDrag] = useState<{ id: string; grab: number; work: number; x0: number; moved: boolean } | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  const lineRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const lunchLen = L1 - L0;
  // Working time skips lunch: 20 minutes pushed into lunch come out the other side of it.
  const toWork = (c: number) => (c < L0 ? c - DAY_START : c < L1 ? L0 - DAY_START : c - lunchLen - DAY_START);
  const fromWork = (w: number) => (DAY_START + w < L0 ? DAY_START + w : DAY_START + w + lunchLen);
  const segments = (w0: number, w1: number) => {
    const cut = L0 - DAY_START;
    if (w1 <= cut || w0 >= cut) return [{ s: fromWork(w0), e: fromWork(w0) + (w1 - w0) }];
    return [{ s: fromWork(w0), e: L0 }, { s: L1, e: L1 + (w1 - cut) }];
  };

  const committed = useMemo(() => toPlan(items, lunch), [items, lunch]);
  const total = items.reduce((a, i) => a + i.minutes, 0);
  const endAt = committed.length ? toMinutes(committed[committed.length - 1].end) : DAY_START;
  const span = Math.max(DAY_END, endAt) - DAY_START;
  const pct = (m: number) => `${((m - DAY_START) / span) * 100}%`;
  const commit = (next: PlanItem[]) => setPlan(toPlan(next, lunch));
  const dragItem = drag ? items.find((x) => x.id === drag.id) : undefined;

  // While dragging, the others make room where the block's middle is: they slide aside live.
  const shown = useMemo(() => {
    if (!drag || !dragItem || !drag.moved || overTrash) return items;
    const others = items.filter((x) => x.id !== drag.id);
    const centre = drag.work + dragItem.minutes / 2;
    let acc = 0;
    let at = others.length;
    for (let i = 0; i < others.length; i++) {
      if (acc + others[i].minutes / 2 > centre) { at = i; break; }
      acc += others[i].minutes;
    }
    return [...others.slice(0, at), dragItem, ...others.slice(at)];
  }, [items, drag, dragItem, overTrash]);
  const laid = useMemo(() => toPlan(shown, lunch), [shown, lunch]);

  const add = () => {
    const name = customName.trim();
    if (pid === CUSTOM && !name) { toast({ title: 'Type the project name', tone: 'error' }); return; }
    if (!mins || mins < 5) { toast({ title: 'Type how long, e.g. 1h 30m', tone: 'error' }); return; }
    commit([...items, { id: `pb${Date.now().toString(36)}${++seq}`, projectId: pid === CUSTOM ? `${OTHER}${name}` : pid, minutes: mins }]);
    setCustomName('');
  };
  const remove = (id: string) => commit(items.filter((x) => x.id !== id));
  const fillYesterday = () => {
    const prev = daily[`${personId}|${previousWorkingDay(date)}`]?.plan ?? [];
    if (!prev.length) { toast({ title: 'No plan saved on the previous working day', tone: 'info' }); return; }
    commit(toItems(prev).map((x) => ({ ...x, id: `pb${Date.now().toString(36)}${++seq}`, actual: undefined })));
    toast({ title: 'Copied the previous day\'s blocks. Save to keep them.', tone: 'success' });
  };

  const workAt = (clientX: number) => {
    const r = lineRef.current!.getBoundingClientRect();
    return toWork(DAY_START + ((clientX - r.left) / r.width) * span);
  };
  const startDrag = (e: ReactPointerEvent, id: string) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const first = committed.find((b) => b.id.split('~')[0] === id);
    if (!first) return;
    const start = toWork(toMinutes(first.start));
    setDrag({ id, grab: workAt(e.clientX) - start, work: start, x0: e.clientX, moved: false });
  };
  // Follow the pointer anywhere on the page until it is released.
  const live = useRef({ drag, shown, overTrash });
  live.current = { drag, shown, overTrash };
  useEffect(() => {
    if (!drag) return;
    const maxWork = Math.max(toWork(DAY_START + span), total);
    const move = (e: PointerEvent) => {
      const d = live.current.drag;
      if (!d) return;
      const it = items.find((x) => x.id === d.id);
      if (!it) return;
      const moved = d.moved || Math.abs(e.clientX - d.x0) > 4;
      const work = Math.round(Math.max(0, Math.min(maxWork - it.minutes, workAt(e.clientX) - d.grab)) / 5) * 5;
      const tr = trashRef.current?.getBoundingClientRect();
      setOverTrash(!!tr && e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom);
      setDrag({ ...d, work, moved });
    };
    const up = () => {
      const { drag: d, shown: order, overTrash: trash } = live.current;
      if (d?.moved) {
        if (trash) { remove(d.id); toast({ title: 'Block removed', tone: 'info' }); }
        else commit(order);
      }
      setDrag(null);
      setOverTrash(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', up, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [drag?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const extraOnLine = extra.filter((x) => x.start && x.end && x.end > x.start);
  const t = reduce ? { duration: 0 } : SPRING;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-surface-2/60 p-3" aria-label="Add a block">
        <label className="text-xs font-semibold text-muted">Project
          <select aria-label="Block project" className="focus-ring mt-1 block w-56 rounded-xl border border-line bg-surface px-2 py-1.5 text-sm text-ink" value={pid} onChange={(e) => setPid(e.target.value)}>
            {active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            <option value={CUSTOM}>Custom (type a name)...</option>
          </select>
        </label>
        <AnimatePresence initial={false}>
          {pid === CUSTOM && (
            <motion.label initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }} className="overflow-hidden text-xs font-semibold text-muted">Name
              <input aria-label="Custom project name" autoFocus className="focus-ring mt-1 block w-48 rounded-xl border border-line bg-surface px-2 py-1.5 text-sm text-ink" placeholder="e.g. Internal training" value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
            </motion.label>
          )}
        </AnimatePresence>
        <label className="text-xs font-semibold text-muted">Time
          <span className="mt-1 block"><DurationInput label="Block time" className="w-24" placeholder="1h 30m" value={mins} onChange={setMins} /></span>
        </label>
        <Btn onClick={add}><Plus size={14} /> Add block</Btn>
        <span className="ml-auto flex flex-wrap gap-2">
          <Btn tone="ghost" className="border border-line bg-surface" onClick={fillYesterday}><Copy size={13} /> Fill from yesterday</Btn>
          <Btn tone="ghost" className="border border-line bg-surface" onClick={() => commit(toItems(defaultPlan(projects, personId)))}><Wand2 size={13} /> From my project hours</Btn>
        </span>
      </div>

      <LunchSetting personId={personId} lunch={lunch} onChange={setLunch} />

      <div>
        <div ref={lineRef} className={cx('relative h-16 touch-none overflow-hidden rounded-2xl bg-surface-2 p-1 transition-shadow', drag?.moved && 'shadow-[inset_0_0_0_2px_rgb(var(--accent)/0.35)]')} data-testid="plan-line">
          <div className="absolute inset-y-1 z-20 flex items-center justify-center rounded-lg bg-grey/80 text-[11px] font-semibold text-grey-ink backdrop-blur-[1px] transition-all"
            style={{ left: pct(L0), width: `${((L1 - L0) / span) * 100}%`, backgroundImage: 'repeating-linear-gradient(135deg, rgb(0 0 0 / 0.06) 0 6px, transparent 6px 12px)' }}
            title={`Lunch ${lunch.start} to ${lunch.end}${lunch.locked ? ', locked' : ''}`}>
            🍽 {lunch.locked && <Lock size={10} className="ml-0.5" />}
          </div>
          <AnimatePresence initial={false}>
            {laid.map((b) => {
              const base = b.id.split('~')[0];
              const s = toMinutes(b.start);
              const e = toMinutes(b.end);
              const slot = drag?.moved && drag.id === base;
              return (
                <motion.div key={b.id} data-plan-block={base}
                  initial={reduce ? false : { opacity: 0, scaleY: 0.3, y: 10 }}
                  animate={{ opacity: 1, scaleY: 1, y: 0, left: pct(s), width: `${((e - s) / span) * 100}%` }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, y: -14, transition: { duration: 0.22 } }}
                  transition={t}
                  whileHover={drag ? undefined : { y: -2, boxShadow: '0 8px 18px -6px rgb(0 0 0 / 0.35)' }}
                  onPointerDown={(ev) => startDrag(ev, base)}
                  className={cx('absolute inset-y-1 cursor-grab touch-none select-none overflow-hidden rounded-lg text-[11px] font-semibold text-white', drag && 'cursor-grabbing', slot && '!bg-transparent border-2 border-dashed border-accent/60')}
                  style={{ background: slot ? undefined : colorFor(b.projectId, b.custom, projects), boxShadow: slot ? 'none' : '0 1px 2px rgb(0 0 0 / 0.15)' }}
                  title={`${nameOf(b.projectId, b.custom, projects)} · ${b.start} to ${b.end} · drag to move`}>
                  {!slot && (
                    <div className="flex h-full w-full items-center gap-1 truncate px-2">
                      <GripVertical size={12} className="shrink-0 opacity-70" />
                      <span className="truncate">{nameOf(b.projectId, b.custom, projects)}</span>
                      <span className="ml-auto shrink-0 rounded bg-black/15 px-1 tabular-nums">{fmtMin(e - s)}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {/* The block under the pointer: follows it exactly, and splits across lunch as it passes through. */}
          {drag?.moved && dragItem && segments(drag.work, drag.work + dragItem.minutes).map((g, i) => (
            <div key={i} data-drag-ghost className={cx('pointer-events-none absolute inset-y-0 z-30 flex items-center gap-1 overflow-hidden truncate rounded-lg px-2 text-[11px] font-semibold text-white shadow-[0_12px_28px_-8px_rgb(0_0_0/0.55)] ring-2 ring-white/90', overTrash && 'opacity-60 saturate-50')}
              style={{ left: pct(g.s), width: `${((g.e - g.s) / span) * 100}%`, background: colorFor(dragItem.projectId, dragItem.custom, projects), transform: 'translateY(-3px) scale(1.03)' }}>
              <GripVertical size={12} className="shrink-0 opacity-70" />
              <span className="truncate">{clock(g.s)} to {clock(g.e)}</span>
            </div>
          ))}
          {extraOnLine.map((x) => {
            const a = Math.max(DAY_START, toMinutes(x.start!));
            const z = Math.min(DAY_START + span, toMinutes(x.end!));
            if (z <= a) return null;
            return <motion.div key={x.id} data-extra-block initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} className="pointer-events-none absolute bottom-0 h-1.5 origin-left rounded-t bg-lavender-strong" style={{ left: pct(a), width: `${((z - a) / span) * 100}%` }} title={`Extra ${x.start} to ${x.end} · ${x.work}`} />;
          })}
          {!laid.length && <p className="absolute inset-0 flex items-center justify-center text-xs text-muted">Pick a project and a time above, then Add block</p>}
        </div>
        <div className="mt-1 flex justify-between px-1 text-[10px] text-faint">{Array.from({ length: Math.floor(span / 60) + 1 }, (_, i) => <span key={i}>{clock(DAY_START + i * 60).replace(':00', '')}</span>)}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span>Planned <b className="text-ink">{fmtMin(total)}</b>{endAt > DAY_END && <span className="ml-1 font-semibold text-coral-ink">· runs past 7pm</span>}</span>
          {extraOnLine.length > 0 && <span><span className="mr-1 inline-block h-2 w-3 rounded bg-lavender-strong align-middle" />Extra hours</span>}
          <span>Drag a block along the line to reorder. Lunch stays put and blocks flow around it.</span>
          <motion.div ref={trashRef}
            animate={overTrash ? { scale: 1.12, rotate: [0, -6, 6, -4, 0] } : drag?.moved ? { scale: 1.04, rotate: 0 } : { scale: 1, rotate: 0 }}
            transition={overTrash ? { rotate: { duration: 0.4, repeat: Infinity }, scale: SPRING } : SPRING}
            data-testid="plan-trash"
            className={cx('ml-auto flex items-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-2 font-semibold transition-colors', overTrash ? 'border-coral-strong bg-coral text-coral-ink' : drag?.moved ? 'border-coral-strong/60 text-coral-ink' : 'border-line')}>
            <Trash2 size={14} /> Drop here to delete
          </motion.div>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" aria-label="Blocks">
          <AnimatePresence initial={false}>
            {shown.map((it, i) => {
              const parts = laid.filter((b) => b.id.split('~')[0] === it.id);
              return (
                <motion.li key={it.id} layout={!reduce} transition={t} initial={reduce ? false : { opacity: 0, x: -16 }} animate={{ opacity: drag?.moved && drag.id === it.id ? 0.5 : 1, x: 0 }} exit={{ opacity: 0, x: 24, height: 0 }}
                  className="flex flex-wrap items-center gap-2 bg-surface px-3 py-2 text-sm" data-plan-row={it.id}>
                  <span className="w-5 text-xs font-bold text-muted">{i + 1}</span>
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: colorFor(it.projectId, it.custom, projects) }} />
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
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
