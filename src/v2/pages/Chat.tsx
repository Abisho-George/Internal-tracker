import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Users, VenetianMask } from 'lucide-react';
import { Modal } from '@/components';
import { PEOPLE } from '../data';
import { first, useStore } from '../store';
import { Avatar, Btn, cx, ago, input } from '../ui';

/** Teams-style anonymous chat: list of chats on the left, the conversation on the right. */
export default function Chat({ onClose }: { onClose?: () => void }) {
  const { me, convs, msgs, aliases, send, createConv } = useStore();
  const mine = useMemo(() => convs.filter((c) => c.memberIds.includes(me)), [convs, me]);
  const [active, setActive] = useState(mine[0]?.id);
  const [text, setText] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const conv = mine.find((c) => c.id === active) ?? mine[0];
  const thread = msgs.filter((m) => m.convId === conv?.id);
  const myAlias = conv ? aliases[`${me}:${conv.id}`] : undefined;
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [thread.length, conv?.id]);

  const title = (c: (typeof mine)[number]) => (c.group ? c.name : `Anonymous chat with ${first(c.memberIds.find((m) => m !== me) ?? '')}`);

  return (
    <div className="flex h-full overflow-hidden bg-surface">
      <aside className="flex w-48 shrink-0 flex-col border-r border-line">
        <div className="flex items-center justify-between p-4">
          <h1 className="font-bold">Chat</h1>
          <button aria-label="New chat" className="focus-ring rounded-lg p-1.5 hover:bg-surface-2" onClick={() => setNewOpen(true)}><Plus size={18} /></button>
        </div>
        <ul className="flex-1 overflow-y-auto px-2">
          {mine.map((c) => {
            const last = msgs.filter((m) => m.convId === c.id).at(-1);
            return (
              <li key={c.id}>
                <button
                  onClick={() => setActive(c.id)}
                  className={cx('focus-ring flex w-full items-center gap-3 rounded-xl p-2 text-left', c.id === conv?.id && 'bg-accent-soft')}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-lavender text-lavender-ink">{c.group ? <Users size={16} /> : <VenetianMask size={16} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{title(c)}</span>
                    <span className="block truncate text-xs text-muted">{last ? `${last.alias}: ${last.text}` : 'No messages yet'}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-line p-4">
          <div className="flex items-center justify-between gap-2"><p className="truncate font-bold">{conv ? title(conv) : 'Chat'}</p>{onClose && <button aria-label="Minimise chat" className="focus-ring rounded-lg px-2 text-lg leading-none text-muted hover:bg-surface-2" onClick={onClose}>–</button>}</div>
          <p className="text-xs text-muted">🎭 Anonymous — nobody, including management, can see who wrote what.{myAlias && ` You appear as ${myAlias}.`}</p>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {thread.length === 0 && <p className="py-10 text-center text-sm text-muted">Say hello 👋</p>}
          {thread.map((m) => {
            const own = m.alias === myAlias;
            return (
              <div key={m.id} className={cx('flex', own && 'justify-end')}>
                <div className={cx('max-w-[75%] rounded-2xl px-3 py-2', own ? 'bg-accent-soft' : 'bg-surface-2')}>
                  <p className="text-xs font-semibold text-muted">{m.alias} · {ago(m.at)}</p>
                  <p className="text-sm">{m.text}</p>
                </div>
              </div>
            );
          })}
          <div ref={end} />
        </div>
        {conv && (
          <form
            className="flex gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!text.trim()) return;
              send(conv.id, text.trim());
              setText('');
            }}
          >
            <input className={input} placeholder="Type an anonymous message" value={text} onChange={(e) => setText(e.target.value)} maxLength={280} />
            <Btn type="submit">Send</Btn>
          </form>
        )}
      </section>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New anonymous chat"
        description="Pick one person for a private chat, or several to create a group."
        size="sm"
        footer={
          <Btn
            disabled={!picked.length}
            onClick={() => {
              const group = picked.length > 1;
              const id = createConv(group ? groupName.trim() || 'New group' : '', [me, ...picked], group);
              setActive(id);
              setPicked([]);
              setGroupName('');
              setNewOpen(false);
            }}
          >
            Start chat
          </Btn>
        }
      >
        <div className="flex flex-wrap gap-2">
          {PEOPLE.filter((p) => p.id !== me).map((p) => {
            const on = picked.includes(p.id);
            return (
              <button
                key={p.id}
                onClick={() => setPicked((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                className={cx('focus-ring flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm', on ? 'border-accent bg-accent-soft font-semibold' : 'border-line')}
              >
                <Avatar id={p.id} size="sm" /> {p.name}
              </button>
            );
          })}
        </div>
        {picked.length > 1 && <input className={cx(input, 'mt-3')} placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />}
      </Modal>
    </div>
  );
}
