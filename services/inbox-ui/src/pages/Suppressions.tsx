import { useEffect, useState, useCallback } from 'react';
import { ShieldOff, Search, X, Trash2, Plus, ChevronLeft, ChevronRight, MailX } from 'lucide-react';
import api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SuppressionReason = 'hard_bounce' | 'soft_bounce' | 'complaint' | 'manual' | 'unsubscribed';

interface SuppressionRow {
  id: string;
  email: string;
  reason: SuppressionReason;
  domain_id: string | null;
  email_log_id: string | null;
  list_id: string | null;
  created_at: string;
}

interface PagedSuppressions {
  data: SuppressionRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const REASON_LABEL: Record<SuppressionReason, string> = {
  hard_bounce:  'Hard bounce',
  soft_bounce:  'Soft bounce',
  complaint:    'Complaint',
  manual:       'Manual',
  unsubscribed: 'Unsubscribed',
};

const REASON_CLASS: Record<SuppressionReason, string> = {
  hard_bounce:  'bg-destructive/10 text-destructive border-destructive/20',
  soft_bounce:  'bg-amber-500/10 text-amber-600 border-amber-200',
  complaint:    'bg-orange-500/10 text-orange-600 border-orange-200',
  manual:       'bg-muted text-muted-foreground border-border',
  unsubscribed: 'bg-blue-500/10 text-blue-600 border-blue-200',
};

const REASON_FILTER_OPTS = [
  { label: 'All reasons',  value: '' },
  { label: 'Hard bounce',  value: 'hard_bounce' },
  { label: 'Soft bounce',  value: 'soft_bounce' },
  { label: 'Complaint',    value: 'complaint' },
  { label: 'Manual',       value: 'manual' },
  { label: 'Unsubscribed', value: 'unsubscribed' },
];

// ─── Add dialog ───────────────────────────────────────────────────────────────

function AddDialog({ open, onClose, onAdded }: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [email,  setEmail]  = useState('');
  const [reason, setReason] = useState<SuppressionReason>('manual');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      await api.post('/api/suppressions', { email, reason });
      onAdded();
      onClose();
      setEmail('');
      setReason('manual');
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(msg ?? 'Failed to add suppression');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Suppress address</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email address</label>
            <Input
              type="email"
              required
              placeholder="user@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-9 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reason</label>
            <Select value={reason} onValueChange={v => setReason(v as SuppressionReason)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="hard_bounce">Hard bounce</SelectItem>
                <SelectItem value="soft_bounce">Soft bounce</SelectItem>
                <SelectItem value="complaint">Complaint</SelectItem>
                <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : 'Suppress'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SuppressionsPage() {
  const [result,      setResult]      = useState<PagedSuppressions | null>(null);
  const [page,        setPage]        = useState(1);
  const [reason,      setReason]      = useState('');
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [addOpen,     setAddOpen]     = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (reason) params.set('reason', reason);
    if (search) params.set('search', search);
    const { data } = await api.get<PagedSuppressions>(`/api/suppressions?${params}`);
    setResult(data);
    setLoading(false);
  }, [page, reason, search]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.delete(`/api/suppressions/${id}`);
      await load();
    } finally {
      setDeleting(null);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldOff size={14} className="text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Reputation</span>
            </div>
            <h1 className="text-2xl font-bold">Suppressions</h1>
          </div>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setAddOpen(true)}>
            <Plus size={12} />
            Add
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search email…"
                className="pl-7 h-8 text-xs"
              />
            </div>
            {search && (
              <Button type="button" variant="ghost" size="icon" className="size-8"
                onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>
                <X size={12} />
              </Button>
            )}
          </form>

          {/* Reason filter */}
          <Select value={reason} onValueChange={v => { setReason(v ?? ''); setPage(1); }}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All reasons" />
            </SelectTrigger>
            <SelectContent>
              {REASON_FILTER_OPTS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-4 flex flex-col gap-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : !result || result.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground py-20">
            <MailX size={24} className="opacity-30" />
            <p className="text-xs">No suppressed addresses</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-6 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Reason</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Added</th>
                <th className="px-4 py-2.5 w-12" />
              </tr>
            </thead>
            <tbody>
              {result.data.map(row => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3 font-mono text-[13px]">{row.email}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0.5 ${REASON_CLASS[row.reason]}`}
                    >
                      {REASON_LABEL[row.reason]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted-foreground tabular-nums">
                    {new Date(row.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      disabled={deleting === row.id}
                      onClick={() => handleDelete(row.id)}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {result && result.pages > 1 && (
        <>
          <Separator />
          <div className="px-6 py-3 flex items-center justify-between flex-shrink-0">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {result.total} total · {result.page}/{result.pages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="size-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={12} />
              </Button>
              <Button variant="outline" size="icon" className="size-7" disabled={page >= result.pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={12} />
              </Button>
            </div>
          </div>
        </>
      )}

      <AddDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />
    </div>
  );
}
