import { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, CheckCircle2, Clock, ExternalLink, Globe, X, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface Domain {
  id: string;
  name: string;
  cf_zone_id: string;
  cf_subdomain_id: string | null;
  verified: number;
  dkim_selector: string | null;
  return_path_domain: string | null;
  created_at: string;
}

interface DnsRecord {
  type: string;
  name: string;
  content: string;
  ttl: number;
  required: boolean;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [dnsModal, setDnsModal] = useState<{ domain: Domain; records: DnsRecord[] } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await api.get<Domain[]>('/api/domains');
    setDomains(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await api.post('/api/domains', { name: form.name });
      setForm({ name: '' });
      setCreating(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Failed to create domain';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(domain: Domain) {
    setVerifying(domain.id);
    try {
      await api.post(`/api/domains/${domain.id}/verify`);
      load();
    } finally {
      setVerifying(null);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    await api.delete(`/api/domains/${deleteId}`);
    setDeleteId(null);
    load();
  }

  async function handleDns(domain: Domain) {
    const { data } = await api.get<DnsRecord[]>(`/api/domains/${domain.id}/dns`);
    setDnsModal({ domain, records: data });
  }

  return (
    <div className="p-6">
      <div className="max-w-[580px]">

        {/* Confirm delete dialog */}
        <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete domain?</DialogTitle>
              <DialogDescription>
                This will remove the domain and revoke all associated API key bindings. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Header */}
          <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Globe size={14} className="text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Sending</span>
            </div>
            <h1 className="text-2xl font-bold">Domains</h1>
          </div>
          <Button onClick={() => { setCreating(true); setFormError(null); }}>
            <Plus size={14} data-icon="inline-start" /> Add domain
          </Button>
        </div>

        {/* Create form */}
        {creating && (
          <Card className="mb-6">
            <CardContent className="pt-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">New sending domain</h2>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setCreating(false)}>
                  <X size={14} />
                </Button>
              </div>
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Domain / subdomain</Label>
                    <Input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="mail.example.com"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 size={14} className="animate-spin" data-icon="inline-start" />}
                    {submitting ? 'Creating…' : 'Create domain'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Domain list */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : domains.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            No domains yet. Add your first sending domain.
          </div>
        ) : (
          <Card className="overflow-hidden p-0 divide-y divide-border gap-0">
            {domains.map(d => (
              <div key={d.id} className="flex items-center px-5 py-4 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    {d.verified ? (
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Clock size={14} className="text-amber-400 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm">{d.name}</span>
                    <span title={d.dkim_selector ? 'DKIM configured' : 'DKIM not configured'}>
                      {d.dkim_selector
                        ? <ShieldCheck size={13} className="text-emerald-500/70" />
                        : <ShieldOff size={13} className="text-muted-foreground/30" />}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">{d.id}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleDns(d)} className="text-xs gap-1.5 h-7 px-2.5">
                    <ExternalLink size={11} /> DNS
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => handleVerify(d)}
                    disabled={verifying === d.id}
                    className="text-xs gap-1.5 h-7 px-2.5 hover:text-emerald-400"
                  >
                    <RefreshCw size={11} className={verifying === d.id ? 'animate-spin' : ''} />
                    {verifying === d.id ? '…' : 'Verify'}
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setDeleteId(d.id)}
                    className="size-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={11} />
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}

      </div>

      {/* DNS records dialog */}
      <Dialog open={!!dnsModal} onOpenChange={open => !open && setDnsModal(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>DNS Records</DialogTitle>
            <DialogDescription>{dnsModal?.domain.name}</DialogDescription>
          </DialogHeader>
          <Alert>
            <AlertDescription>Add these records to your DNS provider to enable sending.</AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2">
            {dnsModal?.records.map((r, i) => (
              <div key={i} className="bg-muted border border-border rounded-lg p-3 font-mono text-xs">
                <div className="flex gap-3 flex-wrap items-start">
                  <Badge variant="outline" className="text-primary font-semibold w-10 flex-shrink-0 justify-center">{r.type}</Badge>
                  <span className="text-foreground flex-shrink-0">{r.name}</span>
                  <span className="text-muted-foreground break-all">{r.content}</span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


interface Domain {
  id: string;
  name: string;
  cf_zone_id: string;
  cf_subdomain_id: string | null;
  verified: number;
  dkim_selector: string | null;
  return_path_domain: string | null;
  created_at: string;
}

interface DnsRecord {
  type: string;
  name: string;
  content: string;
  ttl: number;
  required: boolean;
}
