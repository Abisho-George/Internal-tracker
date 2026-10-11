import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { PEOPLE, type Status } from './data';
import { useStore } from './store';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-card bg-surface p-5 shadow-soft', className)}>{children}</section>;
}

export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-bold">{children}</h2>
      {right}
    </div>
  );
}

export function Btn({ tone = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'soft' | 'ghost' }) {
  return (
    <button
      {...p}
      className={cx(
        'focus-ring inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50',
        tone === 'primary' && 'bg-accent text-accent-on hover:opacity-90',
        tone === 'soft' && 'bg-accent-soft text-accent-ink hover:opacity-90',
        tone === 'ghost' && 'text-muted hover:bg-surface-2',
        className,
      )}
    />
  );
}

const TONE: Record<string, string> = {
  mint: 'bg-mint text-mint-ink',
  sky: 'bg-sky text-sky-ink',
  peach: 'bg-peach text-peach-ink',
  lavender: 'bg-lavender text-lavender-ink',
  butter: 'bg-butter text-butter-ink',
  coral: 'bg-coral text-coral-ink',
  grey: 'bg-grey text-grey-ink',
};

export function Chip({ tone = 'grey', children }: { tone?: string; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold', TONE[tone])}>{children}</span>;
}

export function Avatar({ id, size = 'md' }: { id: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const p = PEOPLE.find((x) => x.id === id);
  const prof = useStore((st) => st.profiles[id]);
  const name = prof?.name?.trim() || p?.name;
  const initials = name ? name.split(' ').map((w) => w[0]).slice(0, 2).join('') : '?';
  const dim = size === 'sm' ? 'h-7 w-7 text-[11px]' : size === 'md' ? 'h-9 w-9 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-24 w-24 text-3xl';
  return (
    <span title={name} className={cx('relative inline-flex shrink-0 items-center justify-center rounded-full font-bold', TONE[p?.color ?? 'grey'], dim)}>
      {prof?.photo ? <img src={prof.photo} alt={name ?? ''} className="h-full w-full rounded-full object-cover" /> : initials}
      {prof?.emoji && size !== 'sm' && <span className="absolute -bottom-1 -right-1 flex h-[1.4em] w-[1.4em] items-center justify-center rounded-full bg-surface text-[0.55em] shadow">{prof.emoji}</span>}
    </span>
  );
}

export const STATUS: Record<Status, { label: string; tone: string }> = {
  todo: { label: 'To do', tone: 'grey' },
  in_progress: { label: 'In progress', tone: 'sky' },
  in_review: { label: 'In review', tone: 'lavender' },
  changes: { label: 'Feedback to address', tone: 'butter' },
  done: { label: 'Done', tone: 'mint' },
};

const STRONG: Record<string, string> = { mint: 'bg-mint-strong', sky: 'bg-sky-strong', peach: 'bg-peach-strong', lavender: 'bg-lavender-strong', butter: 'bg-butter-strong' };

export function Bar({ value, max, tone = 'mint' }: { value: number; max: number; tone?: string }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all duration-500', STRONG[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
export const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};
export const input = 'focus-ring w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm';

/** Runs an action and shows any validation error as a toast instead of crashing. */
export function safe(fn: () => void, onError?: (msg: string) => void): boolean {
  try {
    fn();
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Something went wrong — please try again.';
    onError?.(msg);
    import('@/components').then(({ toast }) => toast({ title: msg, tone: 'info', emoji: '⚠️' }));
    return false;
  }
}

/** Distinct, professional colours per project (cycled). */
export const PROJECT_COLORS = ['#1D3FA0', '#DC2626', '#0E9F6E', '#7C3AED', '#D97706', '#0891B2'];
