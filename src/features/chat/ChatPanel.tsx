import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { format } from 'date-fns';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SendHorizontal, Shuffle, SmilePlus, VenetianMask } from 'lucide-react';
import { addDaysISO, formatClock, parseDate, toISODate, useApp } from '@/store';
import type { ChatMessage } from '@/store/types';
import { Button, EmptyState, IconButton, SlideOver, TONE_SOFT_BG, TextArea, VisuallyHidden, cn } from '@/components';
import {
  CHAT_MAX_CHARS,
  REACTION_EMOJIS,
  aliasEmoji,
  aliasTone,
  freshAlias,
  loadAlias,
  loadReacted,
  reactionKey,
  saveAlias,
  saveReacted,
} from './chatLocal';

export interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
}

function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDaysISO(today, -1)) return 'Yesterday';
  return format(parseDate(date), 'EEEE d MMM');
}

interface MessageRowProps {
  message: ChatMessage;
  reacted: Set<string>;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onToggleReaction: (emoji: string) => void;
}

function MessageRow({ message, reacted, pickerOpen, onTogglePicker, onToggleReaction }: MessageRowProps) {
  const reduce = useReducedMotion();
  const reactions = Object.entries(message.reactions).filter(([, n]) => n > 0);
  return (
    <motion.li
      layout={reduce ? false : 'position'}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex gap-3"
      data-message-id={message.id}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg leading-none',
          TONE_SOFT_BG[aliasTone(message.alias)],
        )}
      >
        {aliasEmoji(message.alias)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
          <span className="font-semibold text-ink">{message.alias}</span>
          <time dateTime={message.createdAt} className="text-xs text-faint">
            {formatClock(message.createdAt)}
          </time>
        </p>
        <p className="mt-1 w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tl-md bg-surface-2 px-3.5 py-2 text-sm leading-relaxed text-ink">
          {message.text}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {reactions.map(([emoji, count]) => {
            const mine = reacted.has(reactionKey(message.id, emoji));
            return (
              <button
                key={emoji}
                type="button"
                aria-pressed={mine}
                aria-label={`${emoji} ${count} ${count === 1 ? 'reaction' : 'reactions'}${mine ? ', including yours' : ''}`}
                onClick={() => onToggleReaction(emoji)}
                className={cn(
                  'focus-ring inline-flex h-7 items-center gap-1 rounded-full border px-2 text-xs font-semibold tabular-nums transition active:scale-95',
                  mine
                    ? 'border-accent/50 bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface text-muted hover:border-faint/50 hover:text-ink',
                )}
              >
                <span aria-hidden className="text-sm leading-none">
                  {emoji}
                </span>
                <span aria-hidden>{count}</span>
              </button>
            );
          })}
          <IconButton
            size="sm"
            icon={SmilePlus}
            label="Add a reaction"
            aria-expanded={pickerOpen}
            onClick={onTogglePicker}
            className="!h-7 !w-7 rounded-full"
            showTooltip={false}
          />
          <AnimatePresence initial={false}>
            {pickerOpen && (
              <motion.div
                role="group"
                aria-label="Pick a reaction"
                initial={reduce ? false : { opacity: 0, scale: 0.9, x: -4 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                className="flex items-center gap-0.5 rounded-full border border-line bg-surface px-1 py-0.5 shadow-soft"
              >
                {REACTION_EMOJIS.map((emoji) => {
                  const mine = reacted.has(reactionKey(message.id, emoji));
                  return (
                    <button
                      key={emoji}
                      type="button"
                      aria-pressed={mine}
                      aria-label={`React with ${emoji}`}
                      onClick={() => onToggleReaction(emoji)}
                      className={cn(
                        'focus-ring inline-flex h-7 w-7 items-center justify-center rounded-full text-base leading-none transition hover:scale-110 hover:bg-surface-2 active:scale-95',
                        mine && 'bg-accent-soft',
                      )}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.li>
  );
}

/**
 * The anonymous lounge. Messages carry only an alias, the text, a time and
 * reaction counts — never a person id. The alias and "my reactions" live in this
 * browser's localStorage only.
 */
export function ChatPanel({ open, onClose }: ChatPanelProps) {
  const chat = useApp((s) => s.chat);
  const today = useApp((s) => s.demoDate);
  const postChatMessage = useApp((s) => s.postChatMessage);
  const reactToChatMessage = useApp((s) => s.reactToChatMessage);

  const [alias, setAlias] = useState<string | null>(null);
  const [reacted, setReacted] = useState<Set<string>>(() => new Set());
  const [text, setText] = useState('');
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef(chat);
  chatRef.current = chat;

  // On open: remember (or create) this browser's alias and reactions.
  useEffect(() => {
    if (!open) return;
    let a = loadAlias();
    if (!a) {
      a = freshAlias(chatRef.current.map((m) => m.alias));
      saveAlias(a);
    }
    setAlias(a);
    setReacted(loadReacted());
    setPickerFor(null);
  }, [open]);

  // Keep the newest message in view.
  const scrollToEnd = useCallback((smooth: boolean) => {
    const body = endRef.current?.closest<HTMLElement>('[data-dialog-body]');
    if (body) body.scrollTo({ top: body.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  const lastId = chat[chat.length - 1]?.id;
  const seenOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      seenOpen.current = false;
      return;
    }
    const smooth = seenOpen.current;
    seenOpen.current = true;
    const raf = requestAnimationFrame(() => scrollToEnd(smooth));
    return () => cancelAnimationFrame(raf);
  }, [open, lastId, scrollToEnd]);

  const groups = useMemo(() => {
    const sorted = [...chat].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const out: { date: string; messages: ChatMessage[] }[] = [];
    for (const m of sorted) {
      const date = toISODate(parseDate(m.createdAt));
      const last = out[out.length - 1];
      if (last && last.date === date) last.messages.push(m);
      else out.push({ date, messages: [m] });
    }
    return out;
  }, [chat]);

  const shuffle = () => {
    const next = freshAlias([...chat.map((m) => m.alias), ...(alias ? [alias] : [])]);
    saveAlias(next);
    setAlias(next);
  };

  const toggleReaction = (messageId: string, emoji: string) => {
    const key = reactionKey(messageId, emoji);
    const next = new Set(reacted);
    if (next.has(key)) {
      next.delete(key);
      reactToChatMessage(messageId, emoji, -1);
    } else {
      next.add(key);
      reactToChatMessage(messageId, emoji, 1);
    }
    setReacted(next);
    saveReacted(next);
    setPickerFor(null);
  };

  const trimmed = text.trim();
  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!trimmed || !alias) return;
    postChatMessage(alias, trimmed.slice(0, CHAT_MAX_CHARS));
    setText('');
    setStatus(`Posted as ${alias}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const remaining = CHAT_MAX_CHARS - text.length;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      width="md"
      icon={
        <span aria-hidden className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-lavender-soft text-lavender-ink">
          <VenetianMask className="h-5 w-5" />
        </span>
      }
      title={
        <span data-testid="chat-header">
          Anonymous lounge{' '}
          <span className="text-sm font-medium leading-snug text-muted">
            — nobody, including management, can see who wrote what.
          </span>
        </span>
      }
      footer={
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex min-w-0 items-center gap-2 text-sm text-ink" aria-live="polite" data-testid="chat-alias">
              <span
                aria-hidden
                className={cn(
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base leading-none',
                  TONE_SOFT_BG[aliasTone(alias ?? '')],
                )}
              >
                {aliasEmoji(alias ?? '')}
              </span>
              <span className="truncate">
                You're <strong className="font-bold">{alias ?? '…'}</strong> 🎭
              </span>
            </p>
            <Button size="sm" variant="ghost" icon={Shuffle} onClick={shuffle}>
              New alias
            </Button>
          </div>
          <form onSubmit={send} className="flex items-end gap-2">
            <TextArea
              data-autofocus
              rows={2}
              value={text}
              maxLength={CHAT_MAX_CHARS}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Message the lounge"
              placeholder="Say something friendly…"
              className="max-h-40 min-h-[44px]"
            />
            <IconButton type="submit" variant="primary" icon={SendHorizontal} label="Send message" disabled={!trimmed} />
          </form>
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span>Enter to send · Shift+Enter for a new line</span>
            <span className={cn('tabular-nums', remaining <= 20 && 'font-semibold text-butter-ink')}>
              {text.length}/{CHAT_MAX_CHARS}
            </span>
          </div>
        </div>
      }
    >
      {chat.length === 0 ? (
        <EmptyState emoji="☕" title="It's quiet in here" description="Say hello — it's all anonymous." />
      ) : (
        <div className="space-y-5" data-testid="chat-messages">
          {groups.map((g) => (
            <section key={g.date} aria-label={dayLabel(g.date, today)}>
              <div className="mb-3 flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-line" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{dayLabel(g.date, today)}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <ul className="space-y-4">
                {g.messages.map((m) => (
                  <MessageRow
                    key={m.id}
                    message={m}
                    reacted={reacted}
                    pickerOpen={pickerFor === m.id}
                    onTogglePicker={() => setPickerFor((cur) => (cur === m.id ? null : m.id))}
                    onToggleReaction={(emoji) => toggleReaction(m.id, emoji)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <div ref={endRef} />
      <VisuallyHidden aria-live="polite">{status}</VisuallyHidden>
    </SlideOver>
  );
}
