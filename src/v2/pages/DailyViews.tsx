import { Plus, X } from 'lucide-react';
import { useStore, type CustomRow, type DayBlock, type ProjectNumbers } from '../store';
import { Chip, cx } from '../ui';
import { colorOf } from './Widgets';

/** Read-only numbers per project; when `targets` is given, shows "achieved / target" with a tick when met. */
export function NumbersView({ numbers, targets, empty = 'Nothing entered.' }: { numbers: ProjectNumbers; targets?: ProjectNumbers; empty?: string }) {
  const projects = useStore((s) => s.projects);
  const ids = [...new Set([...Object.keys(numbers), ...Object.keys(targets ?? {})])].filter((pid) => {
    const vals = { ...(targets?.[pid] ?? {}), ...(numbers[pid] ?? {}) };
    return Object.values(vals).some((v) => v > 0);
  });
  if (!ids.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="space-y-2">
      {ids.map((pid) => {
        const p = projects.find((x) => x.id === pid);
        const keys = [...new Set([...Object.keys(numbers[pid] ?? {}), ...Object.keys(targets?.[pid] ?? {})])].filter((k) => (numbers[pid]?.[k] ?? 0) > 0 || (targets?.[pid]?.[k] ?? 0) > 0);
        return (
          <div key={pid} className="rounded-xl bg-surface-2 p-2.5" style={{ borderLeft: `4px solid ${colorOf(projects, pid)}` }}>
            <p className="mb-1.5 text-xs font-bold">{p?.name ?? 'Project'}</p>
            <div className="flex flex-wrap gap-1.5">
              {keys.map((k) => {
                const label = p?.metrics.find((m) => m.id === k)?.label ?? k;
                const v = numbers[pid]?.[k] ?? 0;
                const t = targets?.[pid]?.[k];
                if (!targets) return <Chip key={k} tone="sky">{label}: <b>{v}</b></Chip>;
                return <Chip key={k} tone={t && v >= t ? 'mint' : t ? 'butter' : 'sky'}>{label}: <b>{v}</b>{t ? ` / ${t}` : ''}{t && v >= t ? ' ✓' : ''}</Chip>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Custom blocks with their target and (if reported) what was achieved. */
export function CustomBlocksView({ plan }: { plan: DayBlock[] }) {
  const custom = plan.filter((b) => b.custom);
  if (!custom.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {custom.map((b) => {
        const c = b.custom!;
        const met = c.achieved != null && c.targetQty > 0 && c.achieved >= c.targetQty;
        return (
          <Chip key={b.id} tone={c.priority ? 'coral' : 'grey'}>
            {c.priority && '★ '}{c.title} · {c.achieved != null ? `${c.achieved}/` : ''}{c.targetQty} {c.unit}{met && ' ✓'}
          </Chip>
        );
      })}
    </div>
  );
}

let rid = 0;
const field = 'focus-ring rounded-xl border border-line bg-surface px-2 py-1 text-sm';

/** Free-form "custom" rows — for anything that came up that isn't a tracked number. */
export function CustomRows({ rows, onChange, hint, suggest }: { rows: CustomRow[]; onChange: (r: CustomRow[]) => void; hint: string; suggest?: CustomRow[] }) {
  const add = (label = '') => onChange([...rows, { id: `cr${++rid}`, label, qty: 0 }]);
  const missing = (suggest ?? []).filter((s) => !rows.some((r) => r.label === s.label));
  return (
    <div className="mt-3 rounded-xl border border-dashed border-line p-3">
      <p className="mb-2 text-xs font-semibold text-muted">Custom · {hint}</p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <input aria-label="Custom item" className={cx(field, 'min-w-0 flex-1')} placeholder="e.g. Client call notes, list cleanup…" value={r.label} onChange={(e) => onChange(rows.map((x) => (x.id === r.id ? { ...x, label: e.target.value } : x)))} />
            <input aria-label="Custom amount" type="number" min={0} className={cx(field, 'w-20 text-right')} value={r.qty || ''} placeholder="0" onChange={(e) => onChange(rows.map((x) => (x.id === r.id ? { ...x, qty: Math.max(0, +e.target.value || 0) } : x)))} />
            <button aria-label="Remove custom item" className="focus-ring rounded-lg p-1 text-muted hover:bg-surface-2" onClick={() => onChange(rows.filter((x) => x.id !== r.id))}><X size={14} /></button>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="focus-ring flex items-center gap-1 rounded-full border border-line px-3 py-1 text-xs font-semibold text-accent-ink hover:bg-surface-2" onClick={() => add()}><Plus size={12} /> Add custom</button>
        {missing.map((m) => <button key={m.id} className="focus-ring rounded-full bg-surface-2 px-3 py-1 text-xs text-muted hover:text-ink" onClick={() => add(m.label)}>+ {m.label}</button>)}
      </div>
    </div>
  );
}

/** Read-only custom rows; with targets, shows achieved / target. */
export function CustomRowsView({ rows, targets }: { rows?: CustomRow[]; targets?: CustomRow[] }) {
  if (!rows?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((r) => {
        const t = targets?.find((x) => x.label === r.label)?.qty;
        return <Chip key={r.id} tone={t ? (r.qty >= t ? 'mint' : 'butter') : 'lavender'}>✎ {r.label}: <b>{r.qty}</b>{t ? ` / ${t}` : ''}{t && r.qty >= t ? ' ✓' : ''}</Chip>;
      })}
    </div>
  );
}
