import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, ChevronLeft, ChevronRight, Search, X, Mail, Hash, Clock, Trash2, FlaskConical } from 'lucide-react';
import api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface TestEmailRow {
  id: string;
  to_address: string;
  from_address: string;
  subject: string;
  status: 'sent' | 'failed';
  cf_message_id: string | null;
  domain_id: string | null;
  template_id: string | null;
  error: string | null;
  is_test: number;
  html_body: string | null;
  text_body: string | null;
  sent_at: string;
}

interface PagedTestEmails {
  data: TestEmailRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ─── Right panel ────────────────────────────────────────────────────────────

function DetailPanel({ log, onDelete }: { log: TestEmailRow; onDelete: () => void }) {
  const sentAt = new Date(log.sent_at);
  const isSent = log.status === 'sent';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex-shrink-0 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isSent
              ? <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" />
              : <XCircle size={13} className="text-destructive flex-shrink-0" />}
            <span className={`text-xs font-semibold ${isSent ? 'text-emerald-600' : 'text-destructive'}`}>
              {isSent ? 'Captured' : 'Failed'}
            </span>
            <span className="text-muted-foreground/30 text-xs">·</span>
            <span className="text-xs text-muted-foreground">{sentAt.toLocaleString()}</span>
          </div>
          <h2 className="text-[15px] font-semibold leading-snug line-clamp-2">
            {log.subject || <span className="text-muted-foreground italic font-normal">No subject</span>}
          </h2>
        </div>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
          <Trash2 size={14} />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="flex flex-col flex-1 overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b border-border h-auto px-0 bg-transparent gap-0">
          <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 py-2.5 text-xs">
            Preview
          </TabsTrigger>
          <TabsTrigger value="source" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 py-2.5 text-xs">
            Source
          </TabsTrigger>
          <TabsTrigger value="metadata" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-5 py-2.5 text-xs">
            Metadata
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <TabsContent value="preview" className="p-0 mt-0 h-full">
            {log.html_body ? (
              <iframe
                srcDoc={log.html_body}
                className="w-full h-full min-h-[400px] border-0"
                title="Email preview"
                sandbox="allow-same-origin"
              />
            ) : log.text_body ? (
              <pre className="p-6 text-sm font-mono whitespace-pre-wrap text-foreground">{log.text_body}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <Mail size={20} className="opacity-40" />
                <p className="text-xs">No body content stored</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="source" className="p-0 mt-0">
            {log.html_body ? (
              <pre className="p-6 text-xs font-mono whitespace-pre-wrap text-foreground overflow-auto">{log.html_body}</pre>
            ) : log.text_body ? (
              <pre className="p-6 text-xs font-mono whitespace-pre-wrap text-foreground overflow-auto">{log.text_body}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                <Mail size={20} className="opacity-40" />
                <p className="text-xs">No body content stored</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="metadata" className="p-6 mt-0 flex flex-col gap-2">
            {[
              { label: 'Log ID', value: log.id, icon: Hash },
              { label: 'CF Message ID', value: log.cf_message_id ?? '—', icon: Hash },
              { label: 'Domain ID', value: log.domain_id ?? '—', icon: Hash },
              { label: 'Template ID', value: log.template_id ?? '—', icon: Hash },
              { label: 'Sent at', value: sentAt.toISOString(), icon: Clock },
              { label: 'Status', value: log.status, icon: isSent ? CheckCircle2 : XCircle },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="bg-card border border-border rounded-lg px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={11} className="text-muted-foreground" />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
                </div>
                <span className={cn(
                  'text-xs font-mono break-all',
                  label === 'Status' ? (isSent ? 'text-emerald-600' : 'text-destructive') : 'text-foreground'
                )}>{value}</span>
              </div>
            ))}
            {log.error && (
              <div className="bg-destructive/8 border border-destructive/15 rounded-lg px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <XCircle size={11} className="text-destructive" />
                  <span className="text-[11px] text-destructive uppercase tracking-wide font-medium">Error</span>
                </div>
                <span className="text-xs font-mono text-destructive/80 break-all">{log.error}</span>
              </div>
            )}
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export default function TestMailboxPage() {
  const [result, setResult] = useState<PagedTestEmails | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<TestEmailRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (search) params.set('search', search);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const { data } = await api.get<PagedTestEmails>(`/api/test-emails?${params}`);
    setResult(data);
    setLoading(false);
  }, [page, search, from, to]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!selected) return;
    if (!confirm('Delete this test email?')) return;
    await api.delete(`/api/test-emails/${selected.id}`);
    setSelected(null);
    load();
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }
  function clearSearch() { setSearch(''); setSearchInput(''); setPage(1); }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Left pane ────────────────────────────────────────────────────── */}
      <div className="w-[560px] flex-shrink-0 flex flex-col border-r border-border overflow-hidden">
        {/* Pane header */}
        <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FlaskConical size={14} className="text-primary" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Testing</span>
              </div>
              <h1 className="text-2xl font-bold">Test Mailbox</h1>
            </div>
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search subject, to, from…"
                className="pl-7 h-8 text-xs"
              />
            </div>
            {search && (
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={clearSearch}>
                <X size={12} />
              </Button>
            )}
          </form>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Input type="date" value={from}
              onChange={e => { setFrom(e.target.value); setPage(1); }}
              className="h-8 text-xs flex-1 text-muted-foreground"
            />
            <span className="text-muted-foreground/50 text-xs">→</span>
            <Input type="date" value={to}
              onChange={e => { setTo(e.target.value); setPage(1); }}
              className="h-8 text-xs flex-1 text-muted-foreground"
            />
            {(from || to) && (
              <Button variant="ghost" size="icon" className="size-8" onClick={() => { setFrom(''); setTo(''); setPage(1); }}>
                <X size={12} />
              </Button>
            )}
          </div>
        </div>

        {/* Email list */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-3 flex flex-col gap-1.5">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-[58px] rounded-lg" />)}
            </div>
          ) : !result || result.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground py-20">
              <Search size={20} className="opacity-40" />
              <p className="text-xs">No test emails</p>
            </div>
          ) : (
            <div className="p-2 flex flex-col gap-px">
              {result.data.map(log => {
                const isActive = selected?.id === log.id;
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className={cn(
                      'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-100 border',
                      isActive
                        ? 'bg-primary/10 border-primary/20'
                        : 'hover:bg-muted/50 border-transparent'
                    )}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {log.status === 'sent'
                        ? <CheckCircle2 size={13} className="text-emerald-500" />
                        : <XCircle size={13} className="text-destructive" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-medium truncate leading-tight text-foreground">
                          {log.subject || <span className="text-muted-foreground italic font-normal">No subject</span>}
                        </p>
                        <Badge className="text-[9px] px-1 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-200 flex-shrink-0">test</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">{log.to_address}</p>
                      {log.error && (
                        <p className="text-[11px] text-destructive/70 truncate mt-0.5">{log.error}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground/50 whitespace-nowrap flex-shrink-0 mt-0.5 border-0 px-0">
                      {new Date(log.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {result && result.pages > 1 && (
          <>
            <Separator />
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0">
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
      </div>

      {/* ── Right pane ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden bg-background">
        {selected ? (
          <DetailPanel key={selected.id} log={selected} onDelete={handleDelete} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground select-none">
            <Mail size={32} strokeWidth={1.2} className="opacity-30" />
            <p className="text-sm">Select a test email to inspect</p>
          </div>
        )}
      </div>
    </div>
  );
}
