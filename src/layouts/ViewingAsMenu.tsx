import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useApp, useCurrentUser } from '@/store';
import type { Person } from '@/store/types';
import { Avatar, Popover, ROLE_LABEL, cn, toast } from '@/components';
import { ROLE_GROUPS, ROLE_HOME } from './nav';

/** "Viewing as" switcher: jump between the demo people (grouped by role, alphabetical). */
export function ViewingAsMenu() {
  const me = useCurrentUser();
  const people = useApp((s) => s.people);
  const setCurrentUser = useApp((s) => s.setCurrentUser);
  const navigate = useNavigate();

  const groups = useMemo(
    () =>
      ROLE_GROUPS.map((g) => ({
        ...g,
        people: people.filter((p) => p.role === g.role).sort((a, b) => a.name.localeCompare(b.name)),
      })).filter((g) => g.people.length > 0),
    [people],
  );

  const select = (person: Person, close: () => void) => {
    close();
    if (person.id === me.id) return;
    setCurrentUser(person.id);
    navigate(ROLE_HOME[person.role]);
    toast({ title: `Now viewing as ${person.firstName}`, tone: 'info', emoji: '👋' });
  };

  return (
    <Popover
      kind="menu"
      label="Viewing as"
      align="end"
      panelClassName="w-80 max-h-[min(78vh,660px)] overflow-y-auto"
      renderTrigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label={`Viewing as ${me.name}. Switch person`}
          className="focus-ring inline-flex h-10 items-center gap-2 rounded-xl py-1 pl-1 pr-2 text-left transition hover:bg-surface-2"
        >
          <Avatar person={me} size="sm" decorative />
          <span className="hidden min-w-0 flex-col leading-tight sm:flex">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">Viewing as</span>
            <span className="max-w-[9rem] truncate text-sm font-semibold text-ink">{me.name}</span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
        </button>
      )}
    >
      {(close) => (
        <div className="py-1">
          <p aria-hidden className="px-2 pb-1 text-xs text-muted">
            Switch who you're viewing the demo as.
          </p>
          {groups.map((group) => (
            <div key={group.role} role="group" aria-labelledby={`viewing-as-${group.role}`} className="mb-1 last:mb-0">
              <p
                aria-hidden
                id={`viewing-as-${group.role}`}
                className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint"
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.people.map((p) => {
                  const current = p.id === me.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={current}
                      onClick={() => select(p, close)}
                      className={cn(
                        'focus-ring flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors',
                        current ? 'bg-accent-soft' : 'hover:bg-surface-2 focus-visible:bg-surface-2',
                      )}
                    >
                      <Avatar person={p} size="sm" decorative />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{p.name}</span>
                        <span className="block truncate text-xs text-muted">{p.title ?? ROLE_LABEL[p.role]}</span>
                      </span>
                      {current && <Check className="h-4 w-4 shrink-0 text-accent-ink" strokeWidth={3} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}
