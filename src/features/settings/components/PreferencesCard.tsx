import { useRef, type KeyboardEvent } from 'react';
import { Check, Moon, Palette, Sun } from 'lucide-react';
import { useApp, useCurrentUser, usePrefs } from '@/store';
import type { AccentKey, ThemeMode } from '@/store/types';
import { Button, Card, Chip, Field, SectionHeader, SegmentedControl, cn } from '@/components';
import { ACCENTS } from '@/theme/accents';

/** Theme (light / dark) and accent preset — saved per person. */
export function PreferencesCard() {
  const me = useCurrentUser();
  const { theme, accent } = usePrefs();
  const setTheme = useApp((s) => s.setTheme);
  const setAccent = useApp((s) => s.setAccent);
  const swatchRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = ACCENTS.find((a) => a.key === accent) ?? ACCENTS[0];

  const choose = (key: AccentKey, focusIndex?: number) => {
    setAccent(key);
    if (focusIndex != null) swatchRefs.current[focusIndex]?.focus();
  };

  // Radio-group keyboard support: arrows move the selection.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % ACCENTS.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + ACCENTS.length) % ACCENTS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ACCENTS.length - 1;
    if (next >= 0) {
      e.preventDefault();
      choose(ACCENTS[next].key, next);
    }
  };

  return (
    <Card as="section" aria-labelledby="prefs-title" className="p-5 sm:p-6" data-testid="prefs-card">
      <SectionHeader
        id="prefs-title"
        icon={Palette}
        tone="lavender"
        title="Your preferences"
        description={`Saved just for you, ${me.firstName}. Changes apply instantly.`}
      />

      <div className="space-y-6">
        <Field label="Theme">
          <SegmentedControl<ThemeMode>
            className="self-start"
            ariaLabel="Theme"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
            ]}
          />
        </Field>

        <div role="group" aria-labelledby="accent-label" className="flex flex-col gap-2">
          <span id="accent-label" className="text-sm font-semibold text-ink">
            Accent colour
          </span>
          <div role="radiogroup" aria-labelledby="accent-label" className="flex flex-wrap items-center gap-3">
            {ACCENTS.map((a, i) => {
              const selected = a.key === accent;
              return (
                <button
                  key={a.key}
                  ref={(el) => {
                    swatchRefs.current[i] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={a.label}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => choose(a.key)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={cn(
                    'focus-ring relative inline-flex h-11 w-11 items-center justify-center rounded-full border-2 transition duration-150 hover:scale-105 active:scale-95',
                    a.swatch,
                    selected ? 'border-ink/70 shadow-lift' : 'border-surface shadow-soft',
                  )}
                >
                  {selected && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface text-ink shadow-soft">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
            <span className="text-sm font-medium text-muted">{current.label}</span>
          </div>
        </div>

        <div className="rounded-2xl bg-surface-2 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-faint">Preview</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" tabIndex={-1} aria-hidden className="pointer-events-none">
              Primary button
            </Button>
            <Button size="sm" variant="soft" tabIndex={-1} aria-hidden className="pointer-events-none">
              Soft button
            </Button>
            <Chip tone={accent} icon="✦">
              {current.label}
            </Chip>
          </div>
        </div>
      </div>
    </Card>
  );
}
