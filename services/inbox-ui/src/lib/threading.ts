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

  // Chronological order so rendering is stable.
  const sorted = [...items].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  // ── Server-authoritative grouping by thread_id ──────────────────────────────
  // The backend now assigns a stable thread_id per conversation chain. When
  // present, trust it exactly — a new email gets its own thread, a reply joins
  // its parent's thread. Fall back to header inference only for legacy rows.
  const groupMap = new Map<string, ThreadGroup>();
  for (const it of sorted) {
    if (it.thread_id) {
      let g = groupMap.get(it.thread_id);
      if (!g) {
        g = { key: it.thread_id, subject: it.subject, items: [] };
        groupMap.set(it.thread_id, g);
      }
      g.items.push(it);
      continue;
    }
    // Legacy item without thread_id — group by header/subject inference.
    const root = findRoot(it, sorted);
    let g = groupMap.get(`legacy:${root.id}`);
    if (!g) {
      g = { key: `legacy:${root.id}`, subject: root.subject, items: [] };
      groupMap.set(`legacy:${root.id}`, g);
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

// Legacy header-based root finder (used only for rows without thread_id).
function findRoot(item: ThreadItem, sorted: ThreadItem[]): ThreadItem {
  const byId = new Map<string, ThreadItem>();
  for (const it of sorted) {
    if (it.message_id) {
      const id = strip(it.message_id);
      if (!byId.has(id)) byId.set(id, it);
    }
  }
  function findParent(cur: ThreadItem): ThreadItem | null {
    if (cur.in_reply_to) {
      const p = byId.get(strip(cur.in_reply_to));
      if (p && p.id !== cur.id) return p;
    }
    const ids = refIds(cur.references);
    for (let i = ids.length - 1; i >= 0; i--) {
      const p = byId.get(ids[i]);
      if (p && p.id !== cur.id) return p;
    }
    const hasUnresolvedRefs = !!cur.in_reply_to || refIds(cur.references).length > 0;
    if (isPrefixed(cur.subject) || hasUnresolvedRefs) {
      const norm = normalizeSubject(cur.subject);
      const curTime = new Date(cur.timestamp).getTime();
      for (const cand of sorted) {
        if (cand.id === cur.id) continue;
        if (new Date(cand.timestamp).getTime() >= curTime) break;
        if (normalizeSubject(cand.subject) === norm) return cand;
      }
    }
    return null;
  }
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

/** The references chain to send when replying to `parent`. */
export function replyReferences(parent: ThreadItem): string | undefined {
  if (!parent.message_id) return parent.references ?? undefined;
  return [parent.references, parent.message_id].filter(Boolean).join(' ');
}
