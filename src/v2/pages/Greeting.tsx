import { useState, type ReactNode } from 'react';
import { Quote, RefreshCw, Smile } from 'lucide-react';
import { first, useStore } from '../store';
import { cx } from '../ui';

const QUOTES = [
  ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['Done is better than perfect.', 'Sheryl Sandberg'],
  ['Quality is not an act, it is a habit.', 'Aristotle'],
  ['Small daily improvements are the key to staggering long-term results.', 'Unknown'],
  ['Every no gets you closer to a yes.', 'Sales proverb'],
  ['Focus on being productive instead of busy.', 'Tim Ferriss'],
  ['Opportunities don’t happen. You create them.', 'Chris Grosser'],
];
const JOKES = [
  'Why did the SDR bring a ladder? To reach the decision maker. 🪜',
  'My CRM and I have a lot in common: we both need a refresh every morning. ☕',
  'I told my prospect a joke about follow-ups. They didn’t reply. So I told it again. And again. 📬',
  'What do you call a templated message that works? A personalised one, apparently. 🎭',
  'LinkedIn: where "Open to work" meets "Not open to your 5th follow-up". 😅',
  'I’m not procrastinating, I’m doing "prospect research". Very deep research. 🕵️',
  'Meetings booked today: 0. Meetings about meetings: 3. 📅',
];

/** "Hi Name" on the left, quote (or joke) of the day on the right. Compact. */
export function Greeting({ extra }: { extra?: ReactNode }) {
  const me = useStore((s) => s.me);
  useStore((s) => s.profiles);
  const dayIdx = Math.floor(Date.now() / 86_400_000);
  const [mode, setMode] = useState<'quote' | 'joke'>(() => { try { return (localStorage.getItem('ls-qotd') as 'quote' | 'joke') || 'quote'; } catch { return 'quote'; } });
  const [shift, setShift] = useState(0);
  const toggle = () => { const m = mode === 'quote' ? 'joke' : 'quote'; setMode(m); try { localStorage.setItem('ls-qotd', m); } catch { /* ignore */ } };
  const q = QUOTES[(dayIdx + shift) % QUOTES.length];
  const j = JOKES[(dayIdx + shift) % JOKES.length];
  return (
    <div className="grid items-center gap-3 md:grid-cols-[auto_1fr]">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Hi {first(me)} 👋</h1>
          <p className="text-xs text-muted">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        {extra}
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-soft md:ml-auto md:max-w-xl">
        <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', mode === 'quote' ? 'bg-accent-soft text-accent-ink' : 'bg-butter text-butter-ink')}>{mode === 'quote' ? <Quote size={15} /> : <Smile size={15} />}</span>
        <p className="min-w-0 flex-1 text-sm">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">{mode === 'quote' ? 'Quote of the day' : 'Joke of the day'}</span>
          {mode === 'quote' ? <>“{q[0]}” <span className="text-muted">- {q[1]}</span></> : j}
        </p>
        <div className="flex shrink-0 flex-col gap-1">
          <button className="focus-ring rounded-lg px-2 py-0.5 text-[11px] font-semibold text-accent-ink hover:bg-surface-2" onClick={toggle}>{mode === 'quote' ? 'Joke instead' : 'Quote instead'}</button>
          <button aria-label="Another one" className="focus-ring flex items-center justify-center rounded-lg py-0.5 text-muted hover:bg-surface-2" onClick={() => setShift((x) => x + 1)}><RefreshCw size={12} /></button>
        </div>
      </div>
    </div>
  );
}
