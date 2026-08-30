import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Send, MailOpen, ChevronDown, ChevronRight, Reply, PenLine } from 'lucide-react';
import {
  getPeople, getThread, markRead, replyTo, composeSend, getInboxes,
  Person, Thread, ThreadItem, Inbox as InboxType,
} from '../../api';
import { cn } from '@/lib/utils';
import { groupThread, replyReferences, ThreadGroup } from '@/lib/threading';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
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

/**
 * Strip the quoted reply portion from an email body.
 * Detects common "On ... wrote:" headers and removes everything from that
 * point onward, including the `> ` quoted lines that follow.
 */
function stripQuotedReply(body: string | null | undefined): string {
  if (!body) return '';
  // Match "On <date>, <name> <email> wrote:" style headers
  const replyHeader = /^On\s.+?wrote:\s*$/m;
  const match = body.match(replyHeader);
  if (match && match.index !== undefined) {
    return body.slice(0, match.index).trim();
  }
  // Also strip lines that are entirely quoted (start with >)
  const lines = body.split('\n');
  const firstQuote = lines.findIndex(l => /^>\s/.test(l));
  if (firstQuote > 0) {
    return lines.slice(0, firstQuote).join('\n').trim();
  }
  return body.trim();
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

function EmailCard({ item, defaultOpen = false, onReply }: {
  item: ThreadItem;
  defaultOpen?: boolean;
  onReply?: (item: ThreadItem) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isSent = item.direction === 'outbound';
  const date = new Date(item.timestamp);
  const subject = item.subject;
  const body = stripQuotedReply(item.body_text);
  const preview = body?.replace(/\s+/g, ' ').trim().slice(0, 120);

  return (
    <div className={cn(
      'rounded-lg border overflow-hidden transition-shadow',
      open ? 'border-zinc-200 shadow-sm' : 'border-zinc-100 hover:border-zinc-200',
    )}>
      <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-zinc-50/60">
        <button
          className="flex-1 flex items-start gap-3 text-left min-w-0"
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

        {/* Per-message reply */}
        {onReply && (
          <button
            onClick={() => onReply(item)}
            className="shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium text-zinc-500 hover:text-orange-600 hover:bg-orange-50 transition-colors"
            title={`Reply to ${isSent ? 'this message' : subject ?? 'message'}`}
          >
            <Reply size={12} />
            Reply
          </button>
        )}
      </div>

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
  onReply: (item: ThreadItem) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const groups = groupThread(thread.thread);

  // Group threads by inbox address
  const inboxGroups = new Map<string, ThreadGroup[]>();
  for (const g of groups) {
    const addr = g.items[0]?.inbox_address ?? 'unknown';
    if (!inboxGroups.has(addr)) inboxGroups.set(addr, []);
    inboxGroups.get(addr)!.push(g);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread.thread.length]);

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
          {groups.length} conversation{groups.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Threads grouped by inbox */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
        {Array.from(inboxGroups.entries()).map(([inboxAddr, inboxThreads]) => (
          <div key={inboxAddr}>
            {/* Inbox header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wide">{inboxAddr}</span>
              <span className="text-[10px] text-zinc-300">{inboxThreads.length} thread{inboxThreads.length !== 1 ? 's' : ''}</span>
              <span className="flex-1 h-px bg-zinc-100" />
            </div>
            {/* Threads within this inbox */}
            <div className="flex flex-col gap-4">
              {inboxThreads.map(group => (
                <div key={group.key} className="flex flex-col gap-2">
                  {/* Sub-thread label */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide truncate">
                      {group.subject ?? '(no subject)'}
                    </span>
                    <span className="text-[10.5px] text-zinc-300 shrink-0">
                      {group.items.length} msg{group.items.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex-1 h-px bg-zinc-100" />
                  </div>
                  {group.items.map((item: ThreadItem, i: number) => (
                    <EmailCard
                      key={item.id}
                      item={item}
                      defaultOpen={i === group.items.length - 1}
                      onReply={onReply}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
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
  const [inboxes, setInboxes] = useState<InboxType[]>([]);

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeFrom, setComposeFrom] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ThreadItem | null>(null);

  function loadPeople() {
    setLoadingPeople(true);
    getPeople({ search: search || undefined })
      .then(({ data }) => setPeople(data))
      .finally(() => setLoadingPeople(false));
  }

  useEffect(() => {
    loadPeople();
  }, [search]);

  useEffect(() => {
    getInboxes().then(setInboxes).catch((err) => {
      console.error('[People] failed to fetch inboxes:', err);
    });
  }, []);

  async function selectPerson(id: string) {
    setSelectedId(id);
    setLoadingThread(true);
    try {
      const t = await getThread(id);
      setThread(t);
      await markRead(id).catch((err) => {
        console.error('[People] failed to mark thread as read:', err);
      });
      setPeople(prev => prev.map(p => p.id === id ? { ...p, unread_count: 0 } : p));
    } finally {
      setLoadingThread(false);
    }
  }

  // Open compose dialog for a brand-new email (to anyone).
  function openCompose() {
    setReplyTarget(null);
    // Prefill with the selected contact if there is one; otherwise blank.
    setComposeTo(selected?.email ?? '');
    setComposeFrom(inboxes[0]?.email ?? '');
    setComposeSubject('');
    setComposeBody('');
    setComposeOpen(true);
  }

  // Open compose dialog pre-filled as a reply to a specific message.
  function openReply(target: ThreadItem) {
    setReplyTarget(target);
    setComposeTo(thread?.person.email ?? '');
    setComposeFrom(target.inbox_address ?? inboxes[0]?.email ?? '');
    setComposeSubject(target.direction === 'inbound' ? `Re: ${target.subject ?? ''}` : target.subject ?? '');
    setComposeBody('');
    setComposeOpen(true);
  }

  async function handleComposeSend() {
    if (!composeBody.trim() || !composeTo.trim() || !composeFrom.trim()) return;
    setComposeSending(true);
    try {
      if (replyTarget && selectedId) {
        await replyTo({
          personId: selectedId,
          to: composeTo,
          from: composeFrom,
          subject: composeSubject,
          text: composeBody.trim(),
          replyToMessageId: replyTarget.message_id ?? '',
          references: replyReferences(replyTarget),
        });
      } else {
        const result = await composeSend({
          to: composeTo,
          from: composeFrom,
          subject: composeSubject,
          text: composeBody.trim(),
          personId: selectedId ?? undefined,
        });
        // If this was a brand-new contact, select it
        if (!selectedId && result.personId) {
          setSelectedId(result.personId);
        }
      }
      setComposeOpen(false);
      // Refresh the people list (new contact may have been created)
      loadPeople();
      // Refresh the thread
      const refreshId = selectedId;
      if (refreshId) {
        const updated = await getThread(refreshId);
        setThread(updated);
      }
    } finally {
      setComposeSending(false);
    }
  }

  const filtered = people.filter(p => filter === 'unread' ? p.unread_count > 0 : true);
  const selected = people.find(p => p.id === selectedId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <OwnerAccessBanner />
      <div className="flex flex-1 overflow-hidden">

      {/* ── Left: contact list ── */}
      <div className="w-[272px] shrink-0 flex flex-col border-r border-border h-full">

        {/* Compose (global) */}
        <div className="px-3 pt-3 shrink-0">
          <button
            onClick={openCompose}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 rounded-md bg-orange-500 text-white text-[12.5px] font-medium hover:bg-orange-600 transition-colors"
          >
            <PenLine size={13} />
            Compose
          </button>
        </div>

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
            onReply={openReply}
          />
        ) : (
          <EmptyState message="Select a contact to view their thread" />
        )}
      </div>

      </div>

      {/* ── Compose / Reply dialog ── */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{replyTarget ? 'Reply' : 'New email'}</DialogTitle>
            {replyTarget && (
              <p className="text-[12px] text-muted-foreground">
                Replying to <span className="font-medium text-foreground">{replyTarget.subject ?? '(no subject)'}</span>
              </p>
            )}
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">From</span>
                <input
                  value={composeFrom}
                  onChange={e => setComposeFrom(e.target.value)}
                  list="compose-from-inboxes"
                  className="h-8 px-2.5 rounded-md border border-border text-[12.5px] outline-none focus:border-orange-300"
                />
                <datalist id="compose-from-inboxes">
                  {inboxes.map(ib => <option key={ib.id} value={ib.email} />)}
                </datalist>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">To</span>
                <input
                  value={composeTo}
                  onChange={e => setComposeTo(e.target.value)}
                  className="h-8 px-2.5 rounded-md border border-border text-[12.5px] outline-none focus:border-orange-300"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-muted-foreground">Subject</span>
              <input
                value={composeSubject}
                onChange={e => setComposeSubject(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-border text-[12.5px] outline-none focus:border-orange-300"
              />
            </div>
            <textarea
              value={composeBody}
              onChange={e => setComposeBody(e.target.value)}
              placeholder="Write your message…"
              rows={8}
              className="w-full px-3 py-2.5 rounded-md border border-border text-[13px] outline-none resize-none focus:border-orange-300"
            />
          </div>
          <DialogFooter>
            <button
              onClick={() => setComposeOpen(false)}
              className="h-8 px-3 rounded-md border border-border text-[12.5px] text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleComposeSend}
              disabled={composeSending || !composeBody.trim() || !composeTo.trim() || !composeFrom.trim()}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-orange-500 text-white text-[12.5px] font-medium hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {composeSending && <Loader2 size={12} className="animate-spin" />}
              {composeSending ? 'Sending…' : 'Send'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
