import { useStore, type DayBlock, type ProjectNumbers } from '../store';
import { Chip } from '../ui';
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
