/**
 * Browser-local bits of the anonymous lounge. Deliberately NOT in app state and
 * NOT keyed by person: the alias and "which reactions are mine" live only in this
 * browser, so nothing in the shared data can tie a message to a person.
 */
import { randomAlias } from '@/store';
import type { PastelKey } from '@/store/types';

export const CHAT_ALIAS_KEY = 'ls-tracker-chat-alias';
export const CHAT_REACTED_KEY = 'ls-tracker-chat-reacted';

/** Reactions offered by the "+" picker. */
export const REACTION_EMOJIS = ['👍', '😂', '❤️', '🎉', '☕', '🙌'] as const;

export const CHAT_MAX_CHARS = 280;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: it simply won't be remembered */
  }
}

function remove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function loadAlias(): string | null {
  const a = read(CHAT_ALIAS_KEY)?.trim();
  return a ? a : null;
}

export function saveAlias(alias: string): void {
  write(CHAT_ALIAS_KEY, alias);
}

/** A random "Adjective Animal" alias, avoiding ones already in the lounge when possible. */
export function freshAlias(avoid: Iterable<string>): string {
  const taken = new Set(avoid);
  let alias = randomAlias();
  for (let i = 0; i < 30 && taken.has(alias); i++) alias = randomAlias();
  return alias;
}

/** My reactions as "<messageId>:<emoji>" keys (no person ids). */
export function loadReacted(): Set<string> {
  try {
    const raw = read(CHAT_REACTED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveReacted(keys: Set<string>): void {
  write(CHAT_REACTED_KEY, JSON.stringify(Array.from(keys)));
}

export const reactionKey = (messageId: string, emoji: string) => `${messageId}:${emoji}`;

/** Forget the alias and my reactions (Settings → Reset demo data). */
export function clearChatLocal(): void {
  remove(CHAT_ALIAS_KEY);
  remove(CHAT_REACTED_KEY);
}

const ANIMAL_EMOJI: Record<string, string> = {
  Otter: '🦦',
  Panda: '🐼',
  Koala: '🐨',
  Heron: '🦢',
  Falcon: '🦅',
  Fox: '🦊',
  Owl: '🦉',
  Dolphin: '🐬',
  Penguin: '🐧',
  Hedgehog: '🦔',
  Lynx: '🐈',
  Robin: '🐦',
  Seal: '🦭',
  Tiger: '🐯',
  Sparrow: '🐤',
  Turtle: '🐢',
};

/** Animal emoji for an alias ("Calm Otter" → 🦦), 🎭 when unknown. */
export function aliasEmoji(alias: string): string {
  const animal = alias.trim().split(/\s+/).pop() ?? '';
  return ANIMAL_EMOJI[animal] ?? '🎭';
}

const TONES: PastelKey[] = ['mint', 'sky', 'peach', 'lavender', 'butter'];

/** A stable pastel for an alias (derived from the alias text only). */
export function aliasTone(alias: string): PastelKey {
  let h = 0;
  for (let i = 0; i < alias.length; i++) h = (h * 31 + alias.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
