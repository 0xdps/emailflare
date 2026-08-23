import { useEffect, useMemo, useState } from 'react';
import { Send, CheckCircle2, XCircle, Mail, Code2, BookOpen, Eye } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import xml from 'highlight.js/lib/languages/xml';
import jsonLang from 'highlight.js/lib/languages/json';
import 'highlight.js/styles/github.min.css';
import api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', jsonLang);

const EMAIL_THEMES = [
  { id: 'default', label: 'Default', color: '#f97316' },
  { id: 'ocean',   label: 'Ocean',   color: '#0ea5e9' },
  { id: 'forest',  label: 'Forest',  color: '#16a34a' },
  { id: 'violet',  label: 'Violet',  color: '#7c3aed' },
  { id: 'slate',   label: 'Slate',   color: '#334155' },
];

function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Theme</span>
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
      <span className="text-[10px] text-muted-foreground capitalize">{value}</span>
    </div>
  );
}

function beautifyHtml(html: string): string {
  try {
    const tab = '  ';
    let level = 0;
    const voids = /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s|\/>|>)/i;
    const lines = html
      .replace(/>\s*</g, '>\n<')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    return lines.map(line => {
      if (line.match(/^<\/\w/)) level = Math.max(0, level - 1);
      const out = tab.repeat(level) + line;
      if (line.match(/^<\w[^>]*>$/) && !voids.test(line) && !line.match(/<\/\w+>$/)) level++;
      return out;
    }).join('\n');
  } catch {
    return html;
  }
}

function SyntaxCode({ code, lang, className = '' }: { code: string; lang: 'html' | 'json'; className?: string }) {
  const __html = useMemo(() => {
    try {
      const formatted = lang === 'html' ? beautifyHtml(code) : code;
      const result = hljs.highlight(formatted, { language: lang === 'html' ? 'xml' : 'json' }).value;
      return result.replace(
        /\{\{(\w+)\}\}/g,
        '<span style="color:#fb923c;background:rgba(251,146,60,.15);border-radius:3px;padding:0 2px">{{$1}}</span>',
      );
    } catch {
      return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }, [code, lang]);
  return (
    <pre className={`hljs rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border border-border p-4 ${className}`}>
      <code dangerouslySetInnerHTML={{ __html }} />
    </pre>
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
  variables: string[];
}

interface Domain {
  id: string;
  name: string;
  verified: number;
}

function extractVars(text: string): string[] {
  const vars = new Set<string>();
  for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) if (m[1]) vars.add(m[1]);
  return Array.from(vars);
}

function applyVarsPreview(text: string, variables: Record<string, string>): string {
  return text.replace(
    /\{\{(\w+)\}\}/g,
    (_, k) =>
      variables[k]
        ? `<span style="background:#fef9c3;color:#713f12;padding:0 2px;border-radius:2px">${variables[k]}</span>`
        : `<span style="background:#fee2e2;color:#991b1b;padding:0 2px;border-radius:2px;font-size:12px">{{${k}}}</span>`,
  );
}

type RightTab = 'preview' | 'code' | 'api';

export default function PlaygroundPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [senderName, setSenderName] = useState('');
  const [fromLocal, setFromLocal] = useState('');
  const [fromDomain, setFromDomain] = useState('');
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; detail?: string } | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [rightTab, setRightTab] = useState<RightTab>('preview');
  const [themeId, setThemeId] = useState('default');

  const keyMode: 'test' | 'live' | null = apiKey.startsWith('eftest_') ? 'test' : apiKey.startsWith('eflive_') || apiKey.startsWith('emailflair_') ? 'live' : null;

  useEffect(() => {
    Promise.all([
      api.get<Template[]>('/api/templates'),
      api.get<Domain[]>('/api/domains'),
    ]).then(([{ data: tpl }, { data: dom }]) => {
      setTemplates(tpl);
      const verified = dom.filter(d => d.verified === 1);
      setDomains(verified);
      if (verified.length > 0) setFromDomain(verified[0].name);
    });
  }, []);

  const itemId = selectedId.startsWith('t:') ? selectedId.slice(2) : '';
  const hasTemplate = itemId !== '';

  const selectedTemplate = useMemo(
    () => (hasTemplate ? templates.find(t => t.id === itemId) ?? null : null),
    [templates, itemId, hasTemplate],
  );

  const detectedVars = useMemo(() => {
    if (!selectedTemplate) return [];
    if (selectedTemplate.variables.length > 0) return selectedTemplate.variables;
    return extractVars(`${selectedTemplate.subject} ${selectedTemplate.html_body}`);
  }, [selectedTemplate]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setVariables({});
    setPreviewHtml('');
    setPreviewSubject('');
    setResult(null);
    if (id.startsWith('t:')) {
      const tpl = templates.find(t => t.id === id.slice(2));
      if (tpl) setSubject(tpl.subject);
    } else {
      setSubject('');
    }
  }

  useEffect(() => {
    if (selectedTemplate && !subject) setSubject(selectedTemplate.subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate]);

  const fromAddress = fromLocal && fromDomain ? `${fromLocal}@${fromDomain}` : '';

  useEffect(() => {
    if (!selectedTemplate) { setPreviewHtml(''); setPreviewSubject(''); return; }
    if (selectedTemplate.layout) {
      api.post<{ html: string; subject: string }>(`/api/templates/${selectedTemplate.id}/preview`, { variables, themeId })
        .then(r => { setPreviewHtml(r.data.html); setPreviewSubject(r.data.subject); })
        .catch(() => setPreviewHtml('<p style="padding:1rem;color:red">Failed to render preview</p>'));
    } else {
      setPreviewHtml(applyVarsPreview(selectedTemplate.html_body, variables));
      setPreviewSubject(applyVarsPreview(selectedTemplate.subject, variables));
    }
  }, [selectedTemplate, variables, themeId]);

  const codePayload = useMemo(() => {
    const templateRef = selectedTemplate?.slug
      ? { templateSlug: selectedTemplate.slug }
      : hasTemplate ? { templateId: itemId } : {};
    const obj: Record<string, unknown> = {
      from: fromAddress || 'hello@yourdomain.com',
      ...(senderName ? { fromName: senderName } : {}),
      to: to || 'recipient@example.com',
      ...(subject ? { subject } : {}),
      ...templateRef,
      themeId,
      variables: Object.keys(variables).length > 0 ? variables : detectedVars.reduce((acc, v) => ({ ...acc, [v]: `<${v}>` }), {}),
    };
    if (Object.keys(obj.variables as object).length === 0) delete obj.variables;
    return JSON.stringify(obj, null, 2);
  }, [fromAddress, senderName, to, subject, hasTemplate, itemId, selectedTemplate, themeId, variables, detectedVars]);

  const curlSnippet = useMemo(
    () => `curl -X POST https://your-emailflare.com/v1/send \\\n  -H "Authorization: Bearer ${apiKey || '<YOUR_API_KEY>'}" \\\n  -H "Content-Type: application/json" \\\n  -d '${codePayload}'`,
    [apiKey, codePayload],
  );

  const fetchSnippet = useMemo(
    () => `const res = await fetch('/v1/send', {\n  method: 'POST',\n  headers: {\n    'Authorization': 'Bearer ${apiKey || '<YOUR_API_KEY>'}',\n    'Content-Type': 'application/json',\n  },\n  body: JSON.stringify(${codePayload}),\n});\nconst data = await res.json();`,
    [apiKey, codePayload],
  );

  const systemTemplates = templates.filter(t => t.is_system === 1);
  const customTemplates = templates.filter(t => t.is_system === 0);
  const tq = templateSearch.trim().toLowerCase();
  const filteredSystemTemplates = systemTemplates.filter(t => {
    if (!tq) return true;
    return (
      t.name.toLowerCase().includes(tq)
      || (t.slug ?? '').toLowerCase().includes(tq)
      || t.subject.toLowerCase().includes(tq)
    );
  });
  const filteredCustomTemplates = customTemplates.filter(t => {
    if (!tq) return true;
    return (
      t.name.toLowerCase().includes(tq)
      || (t.slug ?? '').toLowerCase().includes(tq)
      || t.subject.toLowerCase().includes(tq)
    );
  });

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setResult(null);
    setSending(true);
    try {
      const payload = {
        from: fromAddress,
        ...(senderName ? { fromName: senderName } : {}),
        to, ...(subject ? { subject } : {}),
        variables,
        themeId,
        ...(selectedTemplate.slug ? { templateSlug: selectedTemplate.slug } : { templateId: selectedTemplate.id }),
      };
      await api.post('/v1/send', payload, { headers: { Authorization: `Bearer ${apiKey}` } });
      setResult({ ok: true, message: 'Test email sent! Check your inbox.' });
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: unknown }; status?: number } };
      const raw = e2.response?.data?.error;
      const detail = typeof raw === 'string' ? raw : raw != null ? JSON.stringify(raw) : `HTTP ${e2.response?.status ?? 'unknown'}`;
      setResult({ ok: false, message: 'Failed to send.', detail });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
        <h1 className="text-lg font-semibold tracking-tight">Playground</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Select a template, fill in variables, preview and send a test email.</p>
      </div>

      {/* 2-col layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — config */}
        <ScrollArea className="w-[40rem] flex-shrink-0 border-r border-border">
          <div className="p-5 flex flex-col gap-4">
            {/* Template selector */}
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold">Template</p>
              <ThemePicker value={themeId} onChange={setThemeId} />
              <Input
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
                placeholder="Search templates..."
              />
              <Select value={selectedId} onValueChange={v => v !== null && handleSelect(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="— Select a template —">
                    {selectedTemplate ? selectedTemplate.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filteredSystemTemplates.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Built-in templates ({filteredSystemTemplates.length})</SelectLabel>
                      {filteredSystemTemplates.map(t => (
                        <SelectItem key={t.id} value={`t:${t.id}`}>{t.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {filteredCustomTemplates.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Custom templates ({filteredCustomTemplates.length})</SelectLabel>
                      {filteredCustomTemplates.map(t => (
                        <SelectItem key={t.id} value={`t:${t.id}`}>{t.name}</SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {filteredSystemTemplates.length === 0 && filteredCustomTemplates.length === 0 && (
                    <div className="px-2 py-2 text-xs text-muted-foreground">No templates match "{templateSearch}"</div>
                  )}
                </SelectContent>
              </Select>
              {selectedTemplate && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedTemplate.is_system === 1 && (
                    <Badge variant="secondary" className="text-[10px] text-purple-400 bg-purple-500/10 uppercase">built-in</Badge>
                  )}
                  <p className="text-xs text-muted-foreground truncate">Subject: {previewSubject || selectedTemplate.subject}</p>
                </div>
              )}
            </div>

            {/* Variables */}
            {detectedVars.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold">Variables</p>
                {detectedVars.map(v => (
                  <div key={v} className="flex flex-col gap-1.5">
                    <Label className="text-xs"><code className="font-mono text-primary">{`{{${v}}}`}</code></Label>
                    <Input
                      value={variables[v] ?? ''}
                      onChange={e => setVariables(p => ({ ...p, [v]: e.target.value }))}
                      placeholder={`Value for ${v}`}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Send test form */}
            <form onSubmit={handleSend} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold">Send test email</p>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">API key</Label>
                <div className="flex gap-2 items-center">
                  <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="eftest_… or eflive_…" autoComplete="off" className="flex-1" />
                  {keyMode === 'test' && (
                    <Badge className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-200 whitespace-nowrap">Test mode</Badge>
                  )}
                  {keyMode === 'live' && (
                    <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200 whitespace-nowrap">Live mode</Badge>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Sender name <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="Acme Inc." />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">From</Label>
                <div className="flex gap-1.5 items-center">
                  <Input
                    value={fromLocal}
                    onChange={e => setFromLocal(e.target.value)}
                    placeholder="hello"
                    className="flex-1 min-w-0"
                  />
                  <span className="text-muted-foreground text-sm flex-shrink-0">@</span>
                  {domains.length > 0 ? (
                    <Select value={fromDomain} onValueChange={v => v !== null && setFromDomain(v)}>
                      <SelectTrigger className="flex-1 min-w-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {domains.map(d => (
                          <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={fromDomain}
                      onChange={e => setFromDomain(e.target.value)}
                      placeholder="yourdomain.com"
                      className="flex-1 min-w-0"
                    />
                  )}
                </div>
                {fromAddress && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {senderName ? `"${senderName}" <${fromAddress}>` : fromAddress}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">To</Label>
                <Input type="email" value={to} onChange={e => setTo(e.target.value)} placeholder="you@example.com" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">
                  Subject {selectedTemplate && <span className="text-muted-foreground font-normal">(from template)</span>}
                </Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject…" />
              </div>

              {result && (
                <Alert className={cn(result.ok ? 'border-emerald-500/20 bg-emerald-500/10' : 'border-destructive/20 bg-destructive/10')}>
                  <AlertDescription className="flex items-start gap-2 text-xs">
                    {result.ok
                      ? <CheckCircle2 size={12} className="flex-shrink-0 mt-0.5 text-emerald-400" />
                      : <XCircle size={12} className="flex-shrink-0 mt-0.5 text-destructive" />}
                    <div>
                      <div className={cn('font-medium', result.ok ? 'text-emerald-400' : 'text-destructive')}>{result.message}</div>
                      {result.detail && <div className="opacity-80 mt-0.5">{result.detail}</div>}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={!selectedTemplate || !apiKey || !fromAddress || !to || sending}
                className="w-full gap-2"
              >
                <Send size={13} /> {sending ? 'Sending…' : 'Send test email'}
              </Button>
            </form>
          </div>
        </ScrollArea>

        {/* Right panel — tabbed */}
        <Tabs value={rightTab} onValueChange={v => setRightTab(v as RightTab)} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border flex-shrink-0 px-2">
            <TabsList className="bg-transparent h-auto gap-0 p-0">
              {([
                { id: 'preview' as const, label: 'Live Preview', icon: Eye },
                { id: 'code' as const, label: 'Code Template', icon: Code2 },
                { id: 'api' as const, label: 'API Reference', icon: BookOpen },
              ] as const).map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id} value={id}
                  className="flex items-center gap-1.5 px-4 py-3 text-xs font-medium rounded-none border-b-2 border-transparent
                    text-muted-foreground
                    hover:text-foreground
                    data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-semibold"
                >
                  <Icon size={12} /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="preview" className="h-full mt-0 data-[state=inactive]:hidden">
              {previewHtml ? (
                <iframe srcDoc={previewHtml} className="w-full h-full border-0 bg-white" sandbox="allow-same-origin" title="Email preview" />
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Mail size={40} strokeWidth={1} />
                  <p className="text-sm">Select a template to preview</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="code" className="h-full mt-0 data-[state=inactive]:hidden">
              <ScrollArea className="h-full">
                <div className="p-5 flex flex-col gap-4">
                  {selectedTemplate ? (
                    selectedTemplate.layout ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] text-purple-400 bg-purple-500/20 uppercase">built-in</Badge>
                          <p className="text-xs text-muted-foreground">Rendered server-side via React Email</p>
                        </div>
                        {detectedVars.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Variables</p>
                            <div className="flex flex-wrap gap-2">
                              {detectedVars.map(v => (
                                <span key={v} className="text-xs font-mono bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded-md">{`{{${v}}}`}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {previewHtml && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Rendered HTML</p>
                            <SyntaxCode code={previewHtml} lang="html" />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Subject</p>
                          <pre className="bg-card border border-border rounded-xl px-4 py-3 text-xs text-amber-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">{previewSubject || selectedTemplate.subject}</pre>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">HTML Body</p>
                          <SyntaxCode code={selectedTemplate.html_body} lang="html" />
                        </div>
                        {selectedTemplate.text_body && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Plain Text Body</p>
                            <pre className="bg-card border border-border rounded-xl p-4 text-xs text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">{selectedTemplate.text_body}</pre>
                          </div>
                        )}
                        {detectedVars.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Detected Variables</p>
                            <div className="flex flex-wrap gap-2">
                              {detectedVars.map(v => (
                                <span key={v} className="text-xs font-mono bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded-md">{`{{${v}}}`}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground py-20">
                      <Code2 size={40} strokeWidth={1} />
                      <p className="text-sm">Select a template to see its source code</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="api" className="h-full mt-0 data-[state=inactive]:hidden">
              <ScrollArea className="h-full">
                <div className="p-5 flex flex-col gap-5">
                  {selectedTemplate && (
                    <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                      {selectedTemplate.is_system === 1 && (
                        <Badge variant="secondary" className="text-[10px] text-purple-400 bg-purple-500/20 uppercase">built-in</Badge>
                      )}
                      <span className="text-xs text-muted-foreground truncate">{selectedTemplate.name}</span>
                      {fromAddress && <span className="text-xs text-muted-foreground/50 ml-auto flex-shrink-0">from: {fromAddress}</span>}
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Request Payload</p>
                    <SyntaxCode code={codePayload} lang="json" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">cURL</p>
                    <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-foreground font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">{curlSnippet}</pre>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">fetch (JavaScript)</p>
                    <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-foreground font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">{fetchSnippet}</pre>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">Fields in this request</p>
                    <div className="bg-card border border-border rounded-xl divide-y divide-border">
                      {([
                        { field: 'from', value: fromAddress || null },
                        { field: 'fromName', value: senderName || null },
                        { field: 'to', value: to || null },
                        { field: 'subject', value: subject || null },
                        selectedTemplate
                          ? { field: selectedTemplate.slug ? 'templateSlug' : 'templateId', value: selectedTemplate.slug ?? selectedTemplate.id }
                          : null,
                        { field: 'themeId', value: themeId },
                        ...detectedVars.map(v => ({ field: `variables.${v}`, value: variables[v] || null })),
                      ].filter(Boolean) as Array<{ field: string; value: string | null }>).map(({ field, value }) => (
                        <div key={field} className="flex items-center justify-between px-4 py-2.5 text-xs">
                          <code className="font-mono text-primary">{field}</code>
                          <span className={value ? 'text-foreground font-mono max-w-xs truncate text-right' : 'text-muted-foreground italic'}>
                            {value ?? 'not set'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}


