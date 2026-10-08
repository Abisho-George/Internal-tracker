import type { AccentKey } from '@/store/types';

export interface AccentOption {
  key: AccentKey;
  label: string;
  /** Tailwind class for a solid swatch of this preset (used by the Settings picker). */
  swatch: string;
  /** Soft fill + ink text pair, handy for a "selected" state. */
  soft: string;
}

/** Accent presets offered in Settings → Accent. Order is the display order. */
export const ACCENTS: AccentOption[] = [
  { key: 'lavender', label: 'Lavender', swatch: 'bg-lavender-strong', soft: 'bg-lavender-soft text-lavender-ink' },
  { key: 'mint', label: 'Mint', swatch: 'bg-mint-strong', soft: 'bg-mint-soft text-mint-ink' },
  { key: 'sky', label: 'Sky', swatch: 'bg-sky-strong', soft: 'bg-sky-soft text-sky-ink' },
  { key: 'peach', label: 'Peach', swatch: 'bg-peach-strong', soft: 'bg-peach-soft text-peach-ink' },
  { key: 'butter', label: 'Butter', swatch: 'bg-butter-strong', soft: 'bg-butter-soft text-butter-ink' },
];

export const DEFAULT_ACCENT: AccentKey = 'lavender';
