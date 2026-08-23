import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, FileText, Cpu, X, Mail, ChevronDown } from 'lucide-react';
import api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  slug: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  layout: string | null;
  is_system: number;
  domain_id: string | null;
  variables: string[];
  created_at: string;
  updated_at: string;
}

type Mode = 'list' | 'create' | 'edit';

const EMPTY_FORM = { name: '', slug: '', subject: '', htmlBody: '', textBody: '', domainId: '' };

const EMAIL_THEMES = [
  { id: 'default', label: 'Default', color: '#f97316' },
  { id: 'ocean',   label: 'Ocean',   color: '#0ea5e9' },
  { id: 'forest',  label: 'Forest',  color: '#16a34a' },
  { id: 'violet',  label: 'Violet',  color: '#7c3aed' },
  { id: 'slate',   label: 'Slate',   color: '#334155' },
];

function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mr-0.5">Theme</span>
      {EMAIL_THEMES.map(t => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          onClick={() => onChange(t.id)}
          className={cn(
            'size-4 rounded-full border-2 transition-all duration-100',
            value === t.id ? 'border-white scale-125 shadow-sm' : 'border-transparent opacity-50 hover:opacity-90 hover:scale-110'
          )}
          style={{ background: t.color }}
        />
      ))}
    </div>
  );
}

function extractVars(text: string): string[] {
  const vars = new Set<string>();
  for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) if (m[1]) vars.add(m[1]);
  return Array.from(vars);
}

function TemplateCard({ t, active, varsOpen, onToggleVars, onClick, detectedVars, varValues, onVarChange }: {
  t: Template;
  active: boolean;
  varsOpen: boolean;
  onToggleVars: (e: React.MouseEvent) => void;
  onClick: () => void;
  detectedVars: string[];
  varValues: Record<string, string>;
  onVarChange: (key: string, value: string) => void;
}) {
  const hasVars = t.variables.length > 0;
  return (
    <div className={cn(
      'w-full text-left rounded-xl transition-all duration-100 overflow-hidden border',
      active ? 'bg-primary/10 border-primary/20' : 'hover:bg-muted/50 border-transparent'
    )}>
      <div onClick={onClick} className="px-3 py-3 cursor-pointer">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <span className="text-[13px] font-medium truncate leading-tight text-foreground">
            {t.name}
          </span>
          {t.is_system === 1 && (
            <Badge variant="secondary" className="text-[9px] text-purple-400 bg-purple-500/10 border-purple-500/20 px-1.5 py-0.5 uppercase shrink-0">sys</Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[11px] text-muted-foreground truncate leading-tight">{t.subject}</p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-muted-foreground/40">
              {new Date(t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {active && hasVars && (
              <span
                role="button"
                onClick={onToggleVars}
                className={cn(
                  'flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md transition-colors',
                  varsOpen ? 'text-primary bg-primary/15' : 'text-muted-foreground hover:text-foreground bg-muted/60'
                )}
              >
                <span>{t.variables.length} vars</span>
                <ChevronDown size={9} className={cn('transition-transform duration-150', varsOpen && 'rotate-180')} />
              </span>
            )}
          </div>
        </div>
      </div>
      {active && varsOpen && detectedVars.length > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-primary/10 flex flex-col gap-2.5">
          {detectedVars.map(v => (
            <div key={v}>
              <Label className="text-[10px] font-mono text-primary/70">{`{{${v}}}`}</Label>
              <Input
                value={varValues[v] ?? ''}
                onChange={e => onVarChange(v, e.target.value)}
                placeholder={`Enter ${v}`}
                className="mt-1 h-7 text-xs bg-black/30"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<Mode>('list');
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [previewing, setPreviewing] = useState<Template | null>(null);
  const [previewVars, setPreviewVars] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [varsOpen, setVarsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null);
  const [previewThemeId, setPreviewThemeId] = useState('default');

  async function load() {
    setLoading(true);
    const { data } = await api.get<Template[]>('/api/templates');
    setTemplates(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setMode('create');
  }

  function openEdit(t: Template) {
    setEditing(t);
    setForm({ name: t.name, slug: t.slug ?? '', subject: t.subject, htmlBody: t.html_body, textBody: t.text_body ?? '', domainId: t.domain_id ?? '' });
    setMode('edit');
  }

  async function openPreview(t: Template, themeId = previewThemeId) {
    setPreviewing(t);
    setPreviewVars({});
    setPreviewHtml('');
    setPreviewSubject('');
    setVarsOpen(false);
    setPreviewLoading(true);
    try {
      const { data } = await api.post<{ html: string; subject: string }>(`/api/templates/${t.id}/preview`, { variables: {}, themeId });
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
    } catch {
      setPreviewHtml('<p style="padding:1rem;color:red">Failed to render preview</p>');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function refreshPreview(t: Template, vars: Record<string, string>, themeId = previewThemeId) {
    try {
      const { data } = await api.post<{ html: string; subject: string }>(`/api/templates/${t.id}/preview`, { variables: vars, themeId });
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
    } catch { /* keep previous */ }
  }

  // Re-render preview when theme changes
  useEffect(() => {
    if (previewing) refreshPreview(previewing, previewVars, previewThemeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewThemeId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name, slug: form.slug,
      subject: form.subject, htmlBody: form.htmlBody,
      textBody: form.textBody || undefined, domainId: form.domainId || undefined,
    };
    if (mode === 'create') {
      await api.post('/api/templates', payload);
    } else if (editing) {
      await api.put(`/api/templates/${editing.id}`, payload);
    }
    setMode('list');
    load();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await api.delete(`/api/templates/${deleteTarget.id}`);
    if (previewing?.id === deleteTarget.id) setPreviewing(null);
    setDeleteTarget(null);
    load();
  }

  const editPreviewVars = useMemo(() => extractVars(`${form.subject} ${form.htmlBody}`), [form.subject, form.htmlBody]);
  const [editVarValues, setEditVarValues] = useState<Record<string, string>>({});
  const editPreviewHtml = useMemo(() => {
    if (!form.htmlBody) return '';
    const escHtml = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return form.htmlBody.replace(
      /\{\{(\w+)\}\}/g,
      (_, k) =>
        editVarValues[k]
          ? `<span style="background:#fef9c3;color:#713f12;padding:0 2px;border-radius:2px">${escHtml(editVarValues[k])}</span>`
          : `<span style="background:#fee2e2;color:#991b1b;padding:0 2px;border-radius:2px;font-size:12px">{{${k}}}</span>`,
    );
  }, [form.htmlBody, editVarValues]);

  const previewDetectedVars = useMemo(() => {
    if (!previewing) return [];
    return previewing.variables.length > 0 ? previewing.variables : extractVars(`${previewing.subject} ${previewing.html_body}`);
  }, [previewing]);

  const systemTemplates = templates.filter(t => t.is_system === 1);
  const customTemplates = templates.filter(t => t.is_system === 0);

  const q = search.trim().toLowerCase();
  const filteredSystemTemplates = systemTemplates.filter(t => {
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q)
      || (t.slug ?? '').toLowerCase().includes(q)
      || t.subject.toLowerCase().includes(q)
    );
  });
  const filteredCustomTemplates = customTemplates.filter(t => {
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q)
      || (t.slug ?? '').toLowerCase().includes(q)
      || t.subject.toLowerCase().includes(q)
    );
  });

  // ── Edit / Create view ───────────────────────────────────────────────────
  if (mode !== 'list') {
    return (
      <div className="flex h-full">
        {/* Form panel */}
        <div className="w-[480px] flex-shrink-0 border-r border-border overflow-y-auto p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl font-bold">
              {mode === 'create' ? 'New template' : `Edit — ${editing?.name}`}
            </h1>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => { setMode('list'); setEditVarValues({}); }}>
              <X size={14} />
            </Button>
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Subject</Label>
              <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Slug <span className="text-muted-foreground font-normal">(required)</span></Label>
              <Input
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                placeholder="welcome-email"
                className="font-mono"
                required
              />
              <p className="text-[10px] text-muted-foreground">Used as <code className="text-muted-foreground">templateSlug</code> in the send API.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>HTML body</Label>
              <Textarea
                value={form.htmlBody}
                onChange={e => setForm(f => ({ ...f, htmlBody: e.target.value }))}
                required rows={12}
                className="font-mono"
                placeholder="<p>Hello {{name}},</p>"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Plain-text body <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={form.textBody}
                onChange={e => setForm(f => ({ ...f, textBody: e.target.value }))}
                rows={4} className="font-mono"
                placeholder="Hello {{name}}, ..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit">{mode === 'create' ? 'Create' : 'Save changes'}</Button>
              <Button type="button" variant="ghost" onClick={() => { setMode('list'); setEditVarValues({}); }}>Cancel</Button>
            </div>
          </form>
        </div>

        {/* Live preview panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Preview</span>
            {form.subject && <span className="text-xs text-muted-foreground truncate max-w-xs">{form.subject}</span>}
          </div>
          {editPreviewVars.length > 0 && (
            <div className="px-5 py-3 border-b border-border flex flex-wrap gap-3">
              {editPreviewVars.map(v => (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-primary">{`{{${v}}}`}</span>
                  <Input
                    value={editVarValues[v] ?? ''}
                    onChange={e => setEditVarValues(p => ({ ...p, [v]: e.target.value }))}
                    placeholder={v}
                    className="h-7 text-xs w-28"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 relative">
            {editPreviewHtml ? (
              <div className="h-full overflow-auto">
                <div className="p-4">
                  <div className="max-w-[640px] mx-auto">
                    <div className="bg-[#1e1e1e] rounded-t-xl border border-[#3a3a3a] border-b-0 px-4 py-2.5 flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="size-2.5 rounded-full bg-[#ff5f57]" />
                        <div className="size-2.5 rounded-full bg-[#febc2e]" />
                        <div className="size-2.5 rounded-full bg-[#28c840]" />
                      </div>
                      {form.subject && <span className="text-[11px] text-[#999] font-mono ml-2 truncate">{form.subject}</span>}
                    </div>
                    <div className="bg-white rounded-b-xl overflow-hidden border border-[#3a3a3a] border-t-0">
                      <iframe srcDoc={editPreviewHtml} className="w-full h-full border-0 bg-white" style={{ minHeight: '400px' }} sandbox="allow-same-origin" title="Template preview" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Mail size={40} strokeWidth={1} />
                <p className="text-sm">Your preview will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full">
      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <DialogDescription>
              "{deleteTarget?.name}" will be permanently removed and cannot be restored.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Left pane: template list ──────────────────────────────────── */}
      <div className="w-[560px] flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
        <div className="px-5 pt-5 pb-4 flex-shrink-0 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText size={14} className="text-primary" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Email</span>
            </div>
            <h1 className="text-2xl font-bold">Templates</h1>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{templates.length} total</span>
              <span>•</span>
              <span>{systemTemplates.length} built-in</span>
              <span>•</span>
              <span>{customTemplates.length} custom</span>
            </div>
          </div>
          <Button onClick={openCreate}>
            <Plus size={14} data-icon="inline-start" /> New template
          </Button>
        </div>

        <div className="px-5 pb-3">
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates by name, slug, or subject..."
          />
        </div>

        <ScrollArea className="flex-1 min-h-0">
          {loading ? (
            <div className="p-3 flex flex-col gap-1.5">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-[70px] rounded-lg" />)}
            </div>
          ) : (
            <div className="p-2 flex flex-col gap-4">
              {systemTemplates.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
                    <Cpu size={10} className="text-purple-400" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Built-in ({filteredSystemTemplates.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-px">
                    {filteredSystemTemplates.map(t => (
                      <TemplateCard
                        key={t.id} t={t}
                        active={previewing?.id === t.id}
                        varsOpen={previewing?.id === t.id && varsOpen}
                        onToggleVars={e => { e.stopPropagation(); setVarsOpen(v => !v); }}
                        onClick={() => openPreview(t)}
                        detectedVars={previewing?.id === t.id ? previewDetectedVars : []}
                        varValues={previewVars}
                        onVarChange={(key, val) => {
                          const next = { ...previewVars, [key]: val };
                          setPreviewVars(next);
                          if (previewing) refreshPreview(previewing, next);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-1.5 px-3 pb-1">
                  <FileText size={10} className="text-primary" />
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Custom ({filteredCustomTemplates.length})
                  </span>
                </div>
                {filteredCustomTemplates.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    {q ? (
                      <p className="text-[11px] text-muted-foreground">No custom templates match "{search}"</p>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground">No custom templates yet</p>
                        <Button variant="link" size="sm" onClick={openCreate} className="mt-1 h-auto text-[11px] p-0">
                          Create your first →
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-px">
                    {filteredCustomTemplates.map(t => (
                      <TemplateCard
                        key={t.id} t={t}
                        active={previewing?.id === t.id}
                        varsOpen={previewing?.id === t.id && varsOpen}
                        onToggleVars={e => { e.stopPropagation(); setVarsOpen(v => !v); }}
                        onClick={() => openPreview(t)}
                        detectedVars={previewing?.id === t.id ? previewDetectedVars : []}
                        varValues={previewVars}
                        onVarChange={(key, val) => {
                          const next = { ...previewVars, [key]: val };
                          setPreviewVars(next);
                          if (previewing) refreshPreview(previewing, next);
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right pane: preview ───────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {!previewing ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground select-none">
            <div className="size-14 rounded-2xl bg-white/[0.03] border border-border flex items-center justify-center mb-1">
              <Mail size={22} strokeWidth={1.2} className="opacity-50" />
            </div>
            <p className="text-sm">Select a template to preview</p>
            <Button variant="link" size="sm" onClick={openCreate} className="text-xs text-primary/70 h-auto p-0">
              or create a new one →
            </Button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex-shrink-0 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <h2 className="font-semibold text-[15px] leading-tight">{previewing.name}</h2>
                  {previewing.is_system === 1 && (
                    <Badge variant="secondary" className="text-[10px] text-purple-400 bg-purple-500/15 uppercase tracking-wide">built-in</Badge>
                  )}
                  {previewing.slug && (
                    <Badge variant="outline" className="text-[11px] text-primary/80 font-mono border-primary/10">{previewing.slug}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{previewSubject || previewing.subject}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                <ThemePicker value={previewThemeId} onChange={id => setPreviewThemeId(id)} />
                {previewing.is_system === 0 && (
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => openEdit(previewing)}>
                      <Pencil size={11} /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40" onClick={() => setDeleteTarget(previewing)}>
                      <Trash2 size={11} /> Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Email preview */}
            <ScrollArea className="flex-1">
              <div className="p-6">
                {previewLoading ? (
                  <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground">
                    <div className="size-3.5 border-2 border-muted border-t-primary rounded-full animate-spin" />
                    <span className="text-xs">Rendering…</span>
                  </div>
                ) : previewHtml ? (
                  <div className="max-w-[640px] mx-auto">
                    <div className="bg-[#1e1e1e] rounded-t-xl border border-[#3a3a3a] border-b-0 px-4 py-2.5 flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="size-2.5 rounded-full bg-[#ff5f57]" />
                        <div className="size-2.5 rounded-full bg-[#febc2e]" />
                        <div className="size-2.5 rounded-full bg-[#28c840]" />
                      </div>
                      <span className="text-[11px] text-[#999] font-mono ml-2 truncate">{previewSubject || previewing.subject}</span>
                    </div>
                    <div className="bg-white rounded-b-xl overflow-hidden border border-border border-t-0 shadow-2xl shadow-black/50">
                      <iframe
                        srcDoc={previewHtml}
                        className="w-full border-0 block"
                        style={{ minHeight: '480px', height: 'auto' }}
                        sandbox="allow-same-origin"
                        title="Template preview"
                        onLoad={e => {
                          const iframe = e.currentTarget;
                          const body = iframe.contentDocument?.body;
                          if (body) iframe.style.height = body.scrollHeight + 'px';
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                    <Mail size={20} strokeWidth={1} className="opacity-40" />
                    <p className="text-xs">No preview available</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}


interface Template {
  id: string;
  name: string;
  slug: string | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  layout: string | null;
  is_system: number;
  domain_id: string | null;
  variables: string[];
  created_at: string;
  updated_at: string;
}
