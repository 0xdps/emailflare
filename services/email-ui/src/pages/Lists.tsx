import { useEffect, useState } from 'react';
import { Plus, Trash2, Users, X } from 'lucide-react';
import api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

interface List {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  domain_id: string | null;
  created_at: string;
}

export default function ListsPage() {
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await api.get<List[]>('/api/lists');
    setLists(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      await api.post('/api/lists', { name: form.name, description: form.description || undefined });
      setForm({ name: '', description: '' });
      setCreating(false);
      load();
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setErr(msg ?? 'Failed to create list');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await api.delete(`/api/lists/${id}`);
      load();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6">
      <div className="max-w-[680px]">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Audiences</span>
            </div>
            <h1 className="text-2xl font-bold">Lists</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Lists let you attach one-click unsubscribe headers to sends. A recipient who unsubscribes is suppressed globally.
            </p>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={14} data-icon="inline-start" /> New list
          </Button>
        </div>

        {/* Create form */}
        {creating && (
          <Card className="mb-6">
            <CardContent className="pt-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">New list</h2>
                <Button variant="ghost" size="icon" className="size-6" onClick={() => setCreating(false)}>
                  <X size={14} />
                </Button>
              </div>
              <form onSubmit={handleCreate} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="Product updates"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Description (optional)</Label>
                  <Input
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Weekly product newsletter"
                  />
                </div>
                {err && <p className="text-xs text-destructive">{err}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create'}</Button>
                  <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* List table */}
        {loading ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        ) : lists.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">No lists yet. Create one to enable unsubscribe headers.</div>
        ) : (
          <Card className="overflow-hidden p-0 divide-y divide-border">
            {lists.map(l => (
              <div key={l.id} className="flex items-center px-5 py-3.5 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{l.name}</span>
                    {l.slug && <Badge variant="secondary" className="font-mono text-xs">{l.slug}</Badge>}
                  </div>
                  {l.description && <p className="text-xs text-muted-foreground mt-0.5">{l.description}</p>}
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => handleDelete(l.id)}
                  disabled={deleting === l.id}
                  className="text-xs gap-1.5 h-7 px-2.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={11} /> Delete
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
