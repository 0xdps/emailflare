import type { ThreadItem } from '../api';

// ── RFC 5322 threading helpers ───────────────────────────────────────────────
//
// A message belongs to a thread when its References / In-Reply-To headers link
// it to an existing message. A message with no such links is a new thread root.
// This is what "proper email threads" means: replies/forwards group together,
// brand-new emails stay separate — even from the same sender.

export interface ThreadGroup {
  key: string;
  subject: string | null;
  items: ThreadItem[]; // chronological (oldest first)
}

function strip(id: string): string {
  const t = id.trim();
  return t.startsWith('<') && t.endsWith('>') ? t.slice(1, -1) : t;
}

function refIds(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(/\s+/).filter(Boolean).map(strip);
}

function isPrefixed(s: string | null | undefined): boolean {
  return /^\s*(re|fwd?|fw)\s*:/i.test(s ?? '');
}

function normalizeSubject(s: string | null | undefined): string {
  return (s ?? '')
    .replace(/^\s*(re|fwd?|fw)\s*:/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function groupThread(items: ThreadItem[]): ThreadGroup[] {
  if (items.length === 0) return [];

  // Chronological order so parent lookups and rendering are stable.
  const sorted = [...items].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const byId = new Map<string, ThreadItem>();
  for (const it of sorted) {
    if (it.message_id) {
      const id = strip(it.message_id);
      if (!byId.has(id)) byId.set(id, it);
    }
  }

  // Find the parent of an item via headers, then via a subject-prefix fallback
  // (for forwards/replies that drop reference headers, e.g. Gmail "Forward").
  function findParent(item: ThreadItem): ThreadItem | null {
    if (item.in_reply_to) {
      const p = byId.get(strip(item.in_reply_to));
      if (p && p.id !== item.id) return p;
    }
    const ids = refIds(item.references);
    for (let i = ids.length - 1; i >= 0; i--) {
      const p = byId.get(ids[i]);
      if (p && p.id !== item.id) return p;
    }
    // Subject fallback. A message is a candidate for subject-based linking when:
    //   • its subject carries a Re:/Fwd: prefix, or
    //   • it has threading headers (In-Reply-To/References) that didn't resolve —
    //     e.g. a reply to a Cloudflare-assigned Message-ID we never captured
    //     (compose-new → reply). A truly new email has no such headers, so it
    //     won't be false-merged here.
    const hasUnresolvedRefs = !!item.in_reply_to || refIds(item.references).length > 0;
    if (isPrefixed(item.subject) || hasUnresolvedRefs) {
      const norm = normalizeSubject(item.subject);
      const itemTime = new Date(item.timestamp).getTime();
      for (const cand of sorted) {
        if (cand.id === item.id) continue;
        if (new Date(cand.timestamp).getTime() >= itemTime) break;
        if (normalizeSubject(cand.subject) === norm) return cand;
      }
    }
    return null;
  }

  function findRoot(item: ThreadItem): ThreadItem {
    let cur = item;
    const seen = new Set<string>();
    while (!seen.has(cur.id)) {
      seen.add(cur.id);
      const parent = findParent(cur);
      if (!parent) return cur;
      cur = parent;
    }
    return cur;
  }

  const groupMap = new Map<string, ThreadGroup>();
  for (const it of sorted) {
    const root = findRoot(it);
    let g = groupMap.get(root.id);
    if (!g) {
      g = { key: root.id, subject: root.subject, items: [] };
      groupMap.set(root.id, g);
    }
    g.items.push(it);
  }

  // Newest threads first; items within a thread stay chronological.
  return [...groupMap.values()].sort((a, b) => {
    const ta = a.items[a.items.length - 1]?.timestamp ?? '';
    const tb = b.items[b.items.length - 1]?.timestamp ?? '';
    return new Date(tb).getTime() - new Date(ta).getTime();
  });
}

/** The references chain to send when replying to `parent`. */
export function replyReferences(parent: ThreadItem): string | undefined {
  if (!parent.message_id) return parent.references ?? undefined;
  return [parent.references, parent.message_id].filter(Boolean).join(' ');
}
