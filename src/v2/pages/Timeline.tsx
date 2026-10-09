import { Flag, MapPin, Rocket } from 'lucide-react';
import { day, type Project } from '../data';

const fmt = (d: string) => new Date(d + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Start → today → end track for a project. */
export function Timeline({ project }: { project: Project }) {
  const s = new Date(project.startDate + 'T00:00').getTime();
  const e = new Date(project.endDate + 'T00:00').getTime();
  const n = new Date(day(0) + 'T00:00').getTime();
  const total = Math.max(1, e - s);
  const pct = Math.min(100, Math.max(0, ((n - s) / total) * 100));
  const daysLeft = Math.round((e - n) / 86400000);
  const label = n < s ? `Starts in ${Math.round((s - n) / 86400000)} days` : daysLeft < 0 ? 'Completed' : `Day ${Math.round((n - s) / 86400000) + 1} · ${daysLeft} days left`;

  return (
    <div className="pt-6">
      <div className="relative h-2 rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-gradient-to-r from-accent to-coral-strong" style={{ width: `${pct}%` }} />
        <span className="absolute -top-6 -translate-x-1/2 text-accent" style={{ left: `${pct}%` }} title="Today">
          <MapPin size={18} fill="currentColor" className="text-accent" />
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted">
        <span className="flex items-center gap-1"><Rocket size={12} /> {fmt(project.startDate)}</span>
        <span className="font-semibold text-ink">{label}</span>
        <span className="flex items-center gap-1">{fmt(project.endDate)} <Flag size={12} /></span>
      </div>
    </div>
  );
}
