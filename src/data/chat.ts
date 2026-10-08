/**
 * Anonymous lounge seed. By construction there is NO person id anywhere here:
 * a message only has an alias, the text, a time and emoji reaction counts.
 */
import type { ChatMessage, ISODate } from '@/store/types';
import { isoAt } from '@/store/time';

export const ALIAS_ADJECTIVES = [
  'Calm', 'Sunny', 'Brave', 'Quiet', 'Witty', 'Gentle', 'Happy', 'Clever',
  'Breezy', 'Cosy', 'Jolly', 'Mellow', 'Nimble', 'Zesty', 'Curious', 'Cheerful',
] as const;

export const ALIAS_ANIMALS = [
  'Otter', 'Panda', 'Koala', 'Heron', 'Falcon', 'Fox', 'Owl', 'Dolphin',
  'Penguin', 'Hedgehog', 'Lynx', 'Robin', 'Seal', 'Tiger', 'Sparrow', 'Turtle',
] as const;

/** A random "Adjective Animal" alias, e.g. "Calm Otter". */
export function randomAlias(random: () => number = Math.random): string {
  const adj = ALIAS_ADJECTIVES[Math.floor(random() * ALIAS_ADJECTIVES.length)];
  const animal = ALIAS_ANIMALS[Math.floor(random() * ALIAS_ANIMALS.length)];
  return `${adj} ${animal}`;
}

type ChatSeed = [day: 'yesterday' | 'today', hh: number, mm: number, alias: string, text: string, reactions?: Record<string, number>];

const CHAT_SEED: ChatSeed[] = [
  ['yesterday', 9, 12, 'Sunny Panda', 'Who restocked the masala chai? Whoever you are, you are a hero ☕', { '🙌': 4, '☕': 2 }],
  ['yesterday', 9, 34, 'Calm Otter', 'Monsoon playlist suggestions for the afternoon block? Need something mellow 🌧️', { '🎧': 2 }],
  ['yesterday', 9, 41, 'Witty Falcon', 'Old Hindi film songs. Trust me on this one.', { '😂': 3, '💯': 1 }],
  ['yesterday', 11, 5, 'Brave Koala', 'Is it just me or is the CRM taking its sweet time to load today? 🐢', { '😅': 5 }],
  ['yesterday', 11, 9, 'Quiet Heron', 'Not just you. Perfect excuse for a chai run.', { '☕': 3 }],
  ['yesterday', 13, 18, 'Gentle Fox', 'Friday lunch idea: the dosa place near the station?', { '🤤': 4, '👍': 3 }],
  ['yesterday', 13, 22, 'Sunny Panda', 'Seconded. Their filter coffee is unreal.', { '❤️': 2 }],
  ['yesterday', 16, 45, 'Clever Owl', 'The coffee machine on the 3rd floor is making that noise again. It is alive 👀', { '😂': 6 }],
  ['yesterday', 17, 32, 'Calm Otter', 'Weekend plans anyone? Mine: sleep for 12 hours and call it self-care 😴', { '💯': 3 }],
  ['today', 8, 55, 'Breezy Robin', 'Good morning! It is pouring outside, grab an umbrella on the way in 🌧️', { '☔': 3 }],
  ['today', 9, 20, 'Witty Falcon', 'Monsoon playlist is up on the lounge speaker. Track 4 is a vibe 🎶', { '🎧': 4 }],
  ['today', 10, 5, 'Brave Koala', 'Update: the CRM is behaving today 🙏', { '🎉': 4 }],
  ['today', 10, 40, 'Jolly Penguin', 'Whoever left the samosas in the pantry, thank you 🙏', { '❤️': 5 }],
  ['today', 11, 10, 'Quiet Heron', 'Friday lunch is confirmed: dosa it is. Bring your appetite 😄', { '🥳': 4, '👍': 2 }],
  ['today', 11, 32, 'Mellow Dolphin', 'Gentle reminder to drink water and stretch, the monsoon makes everyone sleepy 💧', { '💧': 2 }],
];

/** ~15 friendly messages: yesterday plus this morning (all before 11:45). */
export function buildChat(yesterday: ISODate, today: ISODate): ChatMessage[] {
  return CHAT_SEED.map(([day, hh, mm, alias, text, reactions], i) => ({
    id: `c-${i + 1}`,
    alias,
    text,
    createdAt: isoAt(day === 'today' ? today : yesterday, hh, mm),
    reactions: { ...(reactions ?? {}) },
  }));
}
