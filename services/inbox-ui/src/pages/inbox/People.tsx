import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Send, MailOpen, ChevronDown, ChevronRight } from 'lucide-react';
import {
  getPeople, getThread, markRead, replyTo,
  Person, Thread, ThreadItem,
} from '../../api';
import { cn } from '@/lib/utils';
import OwnerAccessBanner from '../../components/OwnerAccessBanner';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string) {
  if (name) return name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
  return email[0].toUpperCase();
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Contact row ───────────────────────────────────────────────────────────────

function ContactRow({ person, selected, onClick }: {
  person: Person;
  selected: boolean;
  onClick: () => void;
}) {
  const hasUnread = person.unread_count > 0;
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 flex items-start gap-3 border-b border-border transition-colors relative',
        selected
          ? 'bg-zinc-100'
          : 'hover:bg-zinc-50',
      )}
    >
      {/* Selected indicator */}
      {selected && (
        <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-orange-500" />
      )}

      {/* Avatar */}
      <div className="size-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[11px] font-semibold text-zinc-600">
          {initials(person.name, person.email)}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn(
            'text-[13px] truncate',
            hasUnread ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700',
          )}>
            {person.name ?? person.email}
          </p>
          <span className="text-[11px] text-zinc-400 shrink-0 tabular-nums">
            {person.last_email_at ? relativeTime(person.last_email_at) : ''}
          </span>
        </div>
        {person.name && (
          <p className="text-[11.5px] text-zinc-400 truncate mt-0.5">{person.email}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-zinc-400">
            {person.total_count} msg{person.total_count !== 1 ? 's' : ''}
          </span>
          {hasUnread && (
            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9.5px] font-semibold tabular-nums">
              {person.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Email card ────────────────────────────────────────────────────────────────

function EmailCard({ item, defaultOpen = false }: {
  item: ThreadItem;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isSent = item.direction === 'outbound';
  const date = new Date(item.timestamp);
  const subject = item.subject;
  const body = item.body_text;
  const preview = body?.replace(/\s+/g, ' ').trim().slice(0, 120);

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden transition-shadow',
      open ? 'border-zinc-200 shadow-sm' : 'border-zinc-100 hover:border-zinc-200',
    )}>
      <button
        className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50/60"
        onClick={() => setOpen(v => !v)}
      >
        {/* Sender avatar */}
        <div className={cn(
          'size-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-semibold',
          isSent ? 'bg-orange-100 text-orange-700' : 'bg-zinc-200 text-zinc-600',
        )}>
          {isSent ? 'Me' : subject?.[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12.5px] font-semibold text-zinc-800 truncate">
              {isSent ? 'You' : subject || '(no subject)'}
            </p>
            <span className="text-[11px] text-zinc-400 shrink-0 tabular-nums">
              {date.toLocaleString(undefined, {
                month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
              })}
            </span>
          </div>
          {!open && preview && (
            <p className="text-[12px] text-zinc-400 truncate mt-0.5">{preview}</p>
          )}
          {isSent && (
            <span className="mt-1 inline-block text-[10.5px] text-orange-600 bg-orange-50 border border-orange-100 rounded px-1.5 py-0.5 font-medium">
              Sent
            </span>
          )}
        </div>

        {/* Chevron */}
        <ChevronDown
          size={13}
          className={cn('text-zinc-300 shrink-0 mt-0.5 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-100">
          {body
            ? <p className="text-[13px] text-zinc-700 leading-relaxed whitespace-pre-wrap">{body}</p>
            : <p className="text-[13px] text-zinc-400 italic">No plain-text content</p>
          }
        </div>
      )}
    </div>
  );
}

// ── Thread panel ──────────────────────────────────────────────────────────────

function ThreadPanel({ person, thread, onReply }: {
  person: Person;
  thread: Thread;
  onReply: (params: { text: string; subject: string }) => Promise<void>;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [replyText, setReplyText] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.thread.length]);

  const lastReceived = [...thread.thread]
    .reverse()
    .find(e => e.direction === 'inbound') as ThreadItem | undefined;

  async function handleSend() {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await onReply({
        text: replyText.trim(),
        subject: subject.trim() || `Re: ${lastReceived?.subject ?? '(no subject)'}`,
      });
      setReplyText('');
      setSubject('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="h-14 border-b border-border px-6 flex items-center gap-3 shrink-0 bg-background">
        <div className="size-8 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-semibold text-zinc-600">
            {initials(person.name, person.email)}
          </span>
        </div>
        <div className="flex-1 min-w-0 leading-none">
          <p className="text-[13.5px] font-semibold text-zinc-900">{person.name ?? person.email}</p>
          {person.name && (
            <p className="text-[11.5px] text-zinc-400 mt-[3px]">{person.email}</p>
          )}
        </div>
        <span className="text-[11.5px] text-zinc-400 shrink-0">
          {thread.thread.length} message{thread.thread.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Email cards */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-2">
        {thread.thread.map((item, i) => (
          <EmailCard
            key={item.id}
            item={item}
            defaultOpen={i === thread.thread.length - 1}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose reply */}
      <div className="border-t border-border p-4 shrink-0">
        <div className="rounded-lg border border-zinc-200 bg-white overflow-hidden">
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder={`Re: ${lastReceived?.subject ?? '(no subject)'}`}
            className="w-full px-4 py-2.5 text-[12.5px] text-zinc-700 border-b border-zinc-100
              bg-transparent outline-none placeholder:text-zinc-400"
          />
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Write a reply…"
            rows={3}
            className="w-full px-4 py-3 text-[13px] text-zinc-800 bg-transparent outline-none
              resize-none placeholder:text-zinc-400"
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
            }}
          />
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border-t border-zinc-100">
            <span className="text-[11px] text-zinc-400">⌘ Enter to send</span>
            <button
              onClick={handleSend}
              disabled={sending || !replyText.trim()}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-orange-500 text-white
                text-[12px] font-medium hover:bg-orange-600
                disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending
                ? <Loader2 size={11} className="animate-spin" />
                : <Send size={11} />
              }
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 select-none">
      <MailOpen size={36} strokeWidth={1.25} className="text-zinc-300" />
      <p className="text-[13px] text-zinc-400">{message}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [fromAddress, setFromAddress] = useState('');

  useEffect(() => {
    setLoadingPeople(true);
    getPeople({ search: search || undefined })
      .then(({ data }) => setPeople(data))
      .finally(() => setLoadingPeople(false));
  }, [search]);

  async function selectPerson(id: string) {
    setSelectedId(id);
    setLoadingThread(true);
    try {
      const t = await getThread(id);
      setThread(t);
      await markRead(id).catch(() => {});
      setPeople(prev => prev.map(p => p.id === id ? { ...p, unread_count: 0 } : p));
    } finally {
      setLoadingThread(false);
    }
  }

  async function handleReply({ text, subject }: { text: string; subject: string }) {
    if (!selectedId || !thread) return;
    const lastReceived = [...thread.thread]
      .reverse()
      .find(e => e.direction === 'inbound') as ThreadItem | undefined;
    if (!lastReceived) return;

    // Reply FROM the inbox address the sender wrote to, TO the sender.
    const from = lastReceived.inbox_address ?? fromAddress;
    if (!from) return;

    await replyTo({
      personId: selectedId,
      to: thread.person.email,
      from,
      subject,
      text,
      replyToMessageId: lastReceived.message_id ?? '',
    });
    const updated = await getThread(selectedId);
    setThread(updated);
  }

  const filtered = people.filter(p => filter === 'unread' ? p.unread_count > 0 : true);
  const selected = people.find(p => p.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <OwnerAccessBanner />
      <div className="flex flex-1 overflow-hidden">

      {/* ── Left: contact list ── */}
      <div className="w-[272px] shrink-0 flex flex-col border-r border-border h-full">

        {/* Search + filter bar */}
        <div className="h-14 border-b border-border flex items-center gap-2 px-3 shrink-0">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full h-8 pl-7 pr-3 rounded-md bg-zinc-100 text-[12.5px] text-zinc-800
                placeholder:text-zinc-400 outline-none border border-transparent
                focus:bg-white focus:border-orange-300 transition-colors"
            />
          </div>
          <div className="flex rounded-md border border-border overflow-hidden shrink-0">
            {(['all', 'unread'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'h-8 px-2.5 text-[11.5px] font-medium capitalize transition-colors',
                  filter === f
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-800 bg-white hover:bg-zinc-50',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loadingPeople ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={16} className="animate-spin text-zinc-300" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState message={search ? 'No results' : filter === 'unread' ? 'All caught up' : 'No contacts yet'} />
          ) : (
            filtered.map(p => (
              <ContactRow
                key={p.id}
                person={p}
                selected={p.id === selectedId}
                onClick={() => selectPerson(p.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: thread ── */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        {loadingThread ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={18} className="animate-spin text-zinc-300" />
          </div>
        ) : selected && thread ? (
          <ThreadPanel
            person={selected}
            thread={thread}
            onReply={handleReply}
          />
        ) : (
          <EmptyState message="Select a contact to view their thread" />
        )}
      </div>

      </div>
    </div>
  );
}
