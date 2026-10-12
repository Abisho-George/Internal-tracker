import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { Modal } from '@/components';
import { day, isLeadRole, PEOPLE } from './data';
import { DEFAULT_CUSTOM, first, useStore, type CustomTheme, type ThemeId } from './store';
import { Btn, cx } from './ui';

/** Everything that changes between themes. Professional + Dark keep the original look untouched. */
export interface Look {
  mode: 'light' | 'dark';
  fun?: Exclude<ThemeId, 'pro' | 'dark'>;
  bg: string;
  font: string;
  cards: string;
  nowEmoji?: string;
  blocks: 'solid' | 'striped' | 'candy';
  floaters: string[];
}

const PRESETS: Record<ThemeId, { name: string; blurb: string; swatch: string[]; look: Look }> = {
  pro: { name: 'Professional', blurb: 'The standard Lead Strategus look', swatch: ['#F4F6FB', '#1D3FA0', '#DC2626'], look: { mode: 'light', bg: 'plain', font: 'jakarta', cards: 'classic', blocks: 'solid', floaters: [] } },
  dark: { name: 'Professional Dark', blurb: 'Same thing, lights off', swatch: ['#0B1120', '#789CFF', '#1D3FA0'], look: { mode: 'dark', bg: 'plain', font: 'jakarta', cards: 'classic', blocks: 'solid', floaters: [] } },
  cartoon: { name: 'Cartoon', blurb: 'Thick outlines, wobbly cards, doodles', swatch: ['#FFF8E7', '#EA580C', '#1F1F1F'], look: { mode: 'light', fun: 'cartoon', bg: 'dots', font: 'fredoka', cards: 'cartoon', nowEmoji: '🏃', blocks: 'striped', floaters: ['⭐', '✏️', '☁️', '🎈', '📎'] } },
  comic: { name: 'Comic Book', blurb: 'POW! Halftones and big headlines', swatch: ['#FFEC78', '#DC2626', '#000000'], look: { mode: 'light', fun: 'comic', bg: 'halftone', font: 'bangers', cards: 'cartoon', nowEmoji: '💥', blocks: 'solid', floaters: ['💥', '⚡', '💬', '❗'] } },
  candy: { name: 'Candy Pop', blurb: 'Sweet pastels and bubbly corners', swatch: ['#FFE4F2', '#DB2777', '#A78BFA'], look: { mode: 'light', fun: 'candy', bg: 'candy', font: 'fredoka', cards: 'bubbly', nowEmoji: '🍭', blocks: 'candy', floaters: ['🍬', '🧁', '🍭', '🌈', '🫧'] } },
  space: { name: 'Space Cadet', blurb: 'Neon on a starfield', swatch: ['#080A1E', '#22D3EE', '#A78BFA'], look: { mode: 'dark', fun: 'space', bg: 'stars', font: 'jakarta', cards: 'classic', nowEmoji: '🚀', blocks: 'solid', floaters: ['🪐', '🛸', '✨', '🌙'] } },
  custom: { name: 'Make your own', blurb: 'Pick colours, fonts, emoji…', swatch: ['#F5F3FF', '#7C3AED', '#F59E0B'], look: { mode: 'light', fun: 'custom', bg: 'confetti', font: 'fredoka', cards: 'bubbly', blocks: 'candy', floaters: [] } },
};

const hexToRgb = (h: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
  if (!m) return '124 58 237';
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

/** The current viewer's resolved look. */
export function useLook(): Look & { theme: ThemeId; custom: CustomTheme; mascot: boolean; funExtras: boolean } {
  const prof = useStore((s) => s.profiles[s.me]);
  const theme: ThemeId = prof?.theme ?? (prof?.dark ? 'dark' : 'pro');
  const custom = { ...DEFAULT_CUSTOM, ...prof?.custom };
  const base = PRESETS[theme]?.look ?? PRESETS.pro.look;
  const look: Look = theme === 'custom'
    ? { mode: custom.base, fun: 'custom', bg: custom.background, font: custom.font, cards: custom.cards, nowEmoji: custom.nowEmoji, blocks: custom.blocks, floaters: ['🎉', '✨', '🌈', '⭐', '💫'] }
    : base;
  return { ...look, theme, custom, mascot: prof?.mascot ?? true, funExtras: prof?.fun ?? (theme !== 'pro' && theme !== 'dark') };
}

/** Writes the look onto <html> so the CSS can react. */
export function ThemeApplier() {
  const look = useLook();
  const accent = useStore((s) => s.profiles[s.me]?.accent);
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.theme = look.mode;
    el.dataset.accent = look.fun ? 'brand' : accent ?? 'brand';
    if (look.fun) el.dataset.fun = look.fun; else delete el.dataset.fun;
    el.dataset.bg = look.bg;
    el.dataset.font = look.font;
    el.dataset.cards = look.cards;
    if (look.fun === 'custom') {
      el.style.setProperty('--custom-accent', hexToRgb(look.custom.accent));
      el.style.setProperty('--custom-accent-soft', look.mode === 'dark' ? '40 40 70' : '237 233 254');
    }
  }, [look, accent]);
  return null;
}

/** Slow-drifting emoji in the background (fun themes only; respects reduced motion). */
export function FunLayer() {
  const look = useLook();
  const items = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ i, left: (i * 37) % 100, top: (i * 53) % 100, delay: (i % 6) * 1.1, size: 18 + ((i * 7) % 16) })), []);
  if (!look.funExtras || !look.floaters.length) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {items.map((it) => (
        <span key={it.i} className="ls-float absolute opacity-40" style={{ left: `${it.left}%`, top: `${it.top}%`, animationDelay: `${it.delay}s`, fontSize: it.size }}>
          {look.floaters[it.i % look.floaters.length]}
        </span>
      ))}
    </div>
  );
}

const EMOJIS = ['🏃', '🚀', '🐢', '🦖', '⏰', '☕', '🦄', '🐝'];

/** Theme picker + custom theme editor + mascot / fun toggles. */
export function ThemeMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useStore((s) => s.me);
  const setProfile = useStore((s) => s.setProfile);
  const look = useLook();
  const [editing, setEditing] = useState(false);
  const c = look.custom;
  const setC = (patch: Partial<CustomTheme>) => setProfile(me, { theme: 'custom', custom: { ...c, ...patch } });
  const opt = (on: boolean) => cx('focus-ring rounded-xl border px-3 py-1.5 text-xs font-semibold', on ? 'border-accent bg-accent-soft text-accent-ink' : 'border-line text-muted');

  return (
    <Modal open={open} onClose={onClose} title="Theme" description="Professional and Dark stay exactly as they are. The rest are just for fun." size="lg">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.keys(PRESETS) as ThemeId[]).map((id) => {
          const p = PRESETS[id];
          const on = look.theme === id;
          return (
            <button key={id} onClick={() => { setProfile(me, { theme: id, dark: id === 'dark' }); setEditing(id === 'custom'); }}
              className={cx('focus-ring relative rounded-2xl border-2 p-2 text-left transition hover:-translate-y-0.5', on ? 'border-accent' : 'border-line')}>
              <span className="flex h-14 overflow-hidden rounded-xl">{p.swatch.map((s) => <span key={s} className="flex-1" style={{ background: s }} />)}</span>
              <span className="mt-2 block text-sm font-bold">{p.name}</span>
              <span className="block text-[11px] text-muted">{p.blurb}</span>
              {on && <span className="absolute right-2 top-2 rounded-full bg-accent p-0.5 text-accent-on"><Check size={12} /></span>}
            </button>
          );
        })}
      </div>

      {(editing || look.theme === 'custom') && (
        <div className="mt-5 space-y-3 rounded-2xl border border-dashed border-line p-4 text-sm">
          <p className="font-bold">Make your own</p>
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-muted">Base</span>{(['light', 'dark'] as const).map((b) => <button key={b} className={opt(c.base === b)} onClick={() => setC({ base: b })}>{b === 'light' ? '☀️ Light' : '🌙 Dark'}</button>)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-muted">Accent</span><input aria-label="Accent colour" type="color" value={c.accent} onChange={(e) => setC({ accent: e.target.value })} className="h-8 w-14 cursor-pointer rounded-lg border border-line" />
            {['#7C3AED', '#DB2777', '#EA580C', '#059669', '#2563EB', '#DC2626'].map((h) => <button key={h} aria-label={`Accent ${h}`} className="focus-ring h-7 w-7 rounded-full border-2 border-surface shadow" style={{ background: h }} onClick={() => setC({ accent: h })} />)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-muted">Background</span>{([['plain', 'Plain'], ['dots', 'Dots'], ['confetti', 'Confetti'], ['clouds', 'Clouds'], ['stars', 'Stars']] as const).map(([k, l]) => <button key={k} className={opt(c.background === k)} onClick={() => setC({ background: k })}>{l}</button>)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-muted">Font</span>{([['jakarta', 'Classic'], ['fredoka', 'Rounded'], ['comic', 'Handwritten'], ['bangers', 'Comic headlines']] as const).map(([k, l]) => <button key={k} className={opt(c.font === k)} onClick={() => setC({ font: k })}>{l}</button>)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-muted">Cards</span>{([['classic', 'Classic'], ['cartoon', 'Cartoon outline'], ['bubbly', 'Bubbly']] as const).map(([k, l]) => <button key={k} className={opt(c.cards === k)} onClick={() => setC({ cards: k })}>{l}</button>)}</div>
          <p className="pt-2 font-semibold">My day timeline</p>
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-muted">"Now" marker</span>{EMOJIS.map((e) => <button key={e} aria-label={`Now marker ${e}`} className={cx(opt(c.nowEmoji === e), 'text-base')} onClick={() => setC({ nowEmoji: e })}>{e}</button>)}</div>
          <div className="flex flex-wrap items-center gap-2"><span className="w-28 text-muted">Plan blocks</span>{([['solid', 'Solid'], ['striped', 'Striped'], ['candy', 'Candy gradient']] as const).map(([k, l]) => <button key={k} className={opt(c.blocks === k)} onClick={() => setC({ blocks: k })}>{l}</button>)}</div>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line p-3">
          <img src="./mascot.webp" alt="" className="h-12 w-12 object-contain" />
          <span className="flex-1"><b className="block text-sm">Show mascot</b><span className="text-xs text-muted">On by default. Click him for a sarcastic quip, then some real motivation. Untick to hide him.</span></span>
          <input type="checkbox" aria-label="Show mascot" data-testid="mascot-toggle" checked={look.mascot} onChange={(e) => setProfile(me, { mascot: e.target.checked })} className="h-5 w-5" />
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line p-3">
          <span className="text-3xl">🎈</span>
          <span className="flex-1"><b className="block text-sm">Fun extras</b><span className="text-xs text-muted">Floating doodles in the background</span></span>
          <input type="checkbox" checked={look.funExtras} onChange={(e) => setProfile(me, { fun: e.target.checked })} className="h-5 w-5" />
        </label>
      </div>
      <div className="mt-4 flex justify-end"><Btn onClick={onClose}>Done</Btn></div>
    </Modal>
  );
}

type MascotLine = { kind: 'sarcastic' | 'motivation'; text: string };

/** Office-safe, always-available sarcasm. Context-aware quips are added in front of these. */
const QUIPS = [
  `I hold this spear purely for motivational purposes. Mostly. 🗡️`,
  `Fun fact: a personalised message takes 2 minutes. Scrolling LinkedIn "for research" takes 40.`,
  `Coffee is not a task type. I asked the PM. Denied. ☕`,
  `"Quick call" is the longest phrase in the English language. 📞`,
  `I'd help with the follow-ups, but I'm a drawing. Best excuse in the building.`,
  `Your to-do list called. It feels ignored. 📋`,
  `Another tab open? Bold. The task lives in the first one. 🗂️`,
  `Not saying it's slow today, but the progress bar just yawned. 🥱`,
  `"I'll do it later" is exactly how later got this crowded. ⏳`,
  `Inbox zero is a myth. Like dragons. I would know. 🐉`,
  `The prospect left you on read? Rude. Write a better second message. ✍️`,
  `I've seen snails with tighter follow-up cadences. Lovely snails, though. 🐌`,
];

/** Genuine encouragement. Context-aware lines are added in front of these. */
const MOTIVATION = [
  `Small steady wins add up. One more message, one more step. 💪`,
  `You don't need a perfect day, just a focused next hour. 🎯`,
  `Every "no" gets you closer to a "yes". Keep going. 🚀`,
  `Progress over perfection. Send it, learn, improve. ✨`,
  `The meeting you book next week starts with the message you send now. 📬`,
  `Consistency beats intensity. Show up, do the work, repeat. 🔁`,
  `You've handled harder days than this one. You've got this. 🛡️`,
  `Focus on what you can control: the next task, done well. ✅`,
  `Good work compounds. Today's effort is next month's pipeline. 📈`,
  `Take a breath, pick one task and give it your full attention. 🌱`,
  `Your work moves the whole team forward. Thank you for it. 🙌`,
];

/** The Lead Strategus knight. Clicks alternate a sarcastic quip and genuine motivation; he also pipes up now and then. */
export function Mascot() {
  const { mascot } = useLook();
  const me = useStore((s) => s.me);
  const tasks = useStore((s) => s.tasks);
  const daily = useStore((s) => s.daily);
  const [line, setLine] = useState<MascotLine | null>(null);
  const [n, setN] = useState(0);
  const turn = useRef({ said: 0, quip: 0, boost: 0 });
  const lead = isLeadRole(PEOPLE.find((p) => p.id === me)?.role);
  const open = tasks.filter((t) => t.assigneeId === me && (t.status === 'todo' || t.status === 'in_progress' || t.status === 'changes')).length;
  const today = day(0);
  const d = daily[`${me}|${today}`];
  // Managers and founders have no personal targets: count the team members who haven't set theirs yet.
  const teamNoTargets = lead ? PEOPLE.filter((p) => !isLeadRole(p.role) && !daily[`${p.id}|${today}`]?.sodAt).length : 0;
  const now = new Date();
  const hour = now.getHours();
  const weekday = now.getDay();
  const name = first(me);

  const { quips, boosts } = useMemo(() => {
    const q: string[] = [];
    const workday = weekday >= 1 && weekday <= 5;
    const m: string[] = [];
    if (open > 0) q.push(`${open} open task${open === 1 ? '' : 's'}, ${name}. They won't finish themselves. I checked. Twice. 🕵️`);
    if (open >= 5) q.push(`${open} open tasks and you're reading a cartoon knight. Priorities, ${name}. 👀`);
    if (open === 0) q.push(`Zero open tasks? Either you're a legend or someone forgot to assign you work. 🤔`);
    if (workday && lead && teamNoTargets > 0) q.push(`${teamNoTargets} ${teamNoTargets === 1 ? 'person hasn\'t' : 'people haven\'t'} set today's targets. I'd chase them myself, but no legs. Just vibes. 🤷`);
    if (workday && !lead && !d?.sodAt) q.push(`No targets set for today. Bold strategy. Let's see how it plays out. 🍿`);
    if (workday && !lead && d?.sodAt && !d.eodAt) q.push(`Targets locked. Now for the tiny detail called "doing them". 🔒`);
    if (workday && !lead && hour >= 17 && !d?.eodAt) q.push(`It's ${hour - 12}pm and no end of day update. It won't write itself. I tried. No thumbs. 🛡️`);
    if (hour === 12) q.push(`Lunch is in under an hour. Look busy until then. Or, wild idea, be busy. 🍽️`);
    if (hour === 13) q.push(`Lunch is 1pm to 2pm. It's a time block, not a lifestyle. 🥪`);
    if (weekday === 1) q.push(`Monday. The inbox has been breeding all weekend. Good luck. 📬`);
    if (weekday === 5) q.push(`It's Friday. "Weekend plans" is still not a task type. Nice try. 🎉`);

    if (open === 0) m.push(`All caught up. Take a moment to be proud of that. 🌟`);
    else if (open <= 3) m.push(`Only ${open} left. Pick the hardest one first and the rest will feel easy. 💡`);
    if (!lead && d?.eodAt) m.push(`End of day sent. Well done, now switch off and recharge. 🌙`);
    if (!lead && !d?.sodAt) m.push(`Set three clear targets for today. Clarity is half the work. 🧭`);
    if (lead) m.push(`A quick word of thanks to someone on the team today goes further than you think. 💬`);
    if (weekday === 1) m.push(`Fresh week, fresh start. Set your targets and own it. 🌅`);
    if (weekday === 5) m.push(`Finish the week strong. Monday you will be grateful. 🏁`);
    return { quips: [...q, ...QUIPS], boosts: [...m, ...MOTIVATION] };
  }, [open, d, hour, weekday, name, lead, teamNoTargets]);

  // Alternates: sarcastic, motivation, sarcastic, motivation... Each list cycles in order, context lines first.
  const next = (): MascotLine => {
    const t = turn.current;
    const motivate = t.said % 2 === 1;
    t.said += 1;
    if (motivate) return { kind: 'motivation', text: boosts[t.boost++ % boosts.length] };
    return { kind: 'sarcastic', text: quips[t.quip++ % quips.length] };
  };
  const speak = () => { setN((x) => x + 1); setLine(next()); };
  const speakRef = useRef(speak);
  speakRef.current = speak;

  useEffect(() => {
    if (!mascot) return;
    const t = setInterval(() => speakRef.current(), 120_000);
    return () => clearInterval(t);
  }, [mascot]);
  useEffect(() => {
    if (!line) return;
    const t = setTimeout(() => setLine(null), 8000);
    return () => clearTimeout(t);
  }, [line, n]);

  if (!mascot) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 left-[84px] z-30 flex items-end gap-2 sm:left-[92px]">
      <button aria-label="Mascot: click for a sarcastic quip or some motivation" data-testid="mascot" onClick={speak} className="focus-ring ls-bob pointer-events-auto shrink-0 rounded-full">
        <img src="./mascot.webp" alt="Lead Strategus knight mascot" className="h-16 w-16 object-contain drop-shadow-lg sm:h-24 sm:w-24" />
      </button>
      {line && (
        <div key={n} role="status" data-testid="mascot-line" data-kind={line.kind} className="ls-pop pointer-events-auto relative mb-10 max-w-[min(20rem,calc(100vw-12rem))] rounded-2xl border-2 border-ink bg-surface px-4 py-3 text-sm font-semibold shadow-lift sm:mb-14">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted">{line.kind === 'motivation' ? 'Real talk' : 'Sarcasm mode'}</span>
          {line.text}
          <button aria-label="Dismiss" className="absolute -right-2 -top-2 rounded-full border border-line bg-surface p-0.5" onClick={() => setLine(null)}><X size={12} /></button>
        </div>
      )}
    </div>
  );
}
