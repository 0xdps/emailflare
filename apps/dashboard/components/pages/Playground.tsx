"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
	Send,
	CheckCircle2,
	XCircle,
	Mail,
	Code2,
	BookOpen,
	Eye,
	FlaskConical,
	Zap,
	ArrowRight,
	Copy,
	Check,
	Terminal,
	Search,
} from "lucide-react";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import jsonLang from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import "highlight.js/styles/github.min.css";
import api, { sendPlaygroundEmail } from "@/lib/api";
import { PageHeader } from "@/components/app/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	SelectGroup,
	SelectLabel,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

hljs.registerLanguage("xml", xml);
hljs.registerLanguage("json", jsonLang);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);

const EMAIL_THEMES = [
	{ id: "default", label: "Default", color: "#f97316" },
	{ id: "ocean", label: "Ocean", color: "#0ea5e9" },
	{ id: "forest", label: "Forest", color: "#16a34a" },
	{ id: "violet", label: "Violet", color: "#7c3aed" },
	{ id: "slate", label: "Slate", color: "#334155" },
];

function ThemePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
	return (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="text-2xs font-medium tracking-wider text-muted-foreground uppercase">Theme</span>
			{EMAIL_THEMES.map((t) => (
				<Button
					key={t.id}
					type="button"
					variant="ghost"
					size="icon-xs"
					title={t.label}
					aria-label={t.label}
					aria-pressed={value === t.id}
					onClick={() => onChange(t.id)}
					className={cn(
						"size-4 rounded-full border-2 p-0 transition-all duration-100 hover:bg-transparent dark:hover:bg-transparent",
						value === t.id
							? "scale-125 border-foreground shadow-sm"
							: "border-transparent opacity-50 hover:scale-110 hover:opacity-90",
					)}
					style={{ background: t.color }}
				/>
			))}
			<span className="text-2xs text-muted-foreground capitalize">{value}</span>
		</div>
	);
}

function beautifyHtml(html: string): string {
	try {
		const tab = "  ";
		let level = 0;
		const voids = /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s|\/>|>)/i;
		const lines = html
			.replace(/>\s*</g, ">\n<")
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
		return lines
			.map((line) => {
				if (line.match(/^<\/\w/)) level = Math.max(0, level - 1);
				const out = tab.repeat(level) + line;
				if (line.match(/^<\w[^>]*>$/) && !voids.test(line) && !line.match(/<\/\w+>$/)) level++;
				return out;
			})
			.join("\n");
	} catch {
		return html;
	}
}

function SyntaxCode({
	code,
	lang,
	className = "",
}: {
	code: string;
	lang: "html" | "json" | "bash" | "typescript" | "python";
	className?: string;
}) {
	const __html = useMemo(() => {
		try {
			const formatted = lang === "html" ? beautifyHtml(code) : code;
			const hlLang =
				lang === "html"
					? "xml"
					: lang === "json"
						? "json"
						: lang === "bash"
							? "bash"
							: lang === "typescript"
								? "typescript"
								: "python";
			const result = hljs.highlight(formatted, { language: hlLang }).value;
			return result.replace(
				/\{\{(\w+)\}\}/g,
				'<span style="color:var(--primary);background:color-mix(in oklab,var(--primary) 15%,transparent);border-radius:3px;padding:0 2px">{{$1}}</span>',
			);
		} catch {
			return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}
	}, [code, lang]);

	return (
		<pre
			className={cn(
				"hljs overflow-x-auto rounded-lg border border-border p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap",
				className,
			)}
		>
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

interface ApiKeyItem {
	id: string;
	name: string;
	key_prefix: string;
	key_type: "test" | "live";
	scope: "global" | "domain" | "multi";
	active: number;
}

function extractVars(text: string): string[] {
	const vars = new Set<string>();
	for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) if (m[1]) vars.add(m[1]);
	return Array.from(vars);
}

function applyVarsPreview(text: string, variables: Record<string, string>): string {
	return text.replace(/\{\{(\w+)\}\}/g, (_, k) =>
		variables[k]
			? `<span style="background:#fef9c3;color:#713f12;padding:0 2px;border-radius:2px">${variables[k]}</span>`
			: `<span style="background:#fee2e2;color:#991b1b;padding:0 2px;border-radius:2px;font-size:12px">{{${k}}}</span>`,
	);
}

type RightTab = "preview" | "code" | "snippets" | "api";
type SnippetLang = "curl" | "typescript" | "python";

export default function PlaygroundPage() {
	const [deliveryMode, setDeliveryMode] = useState<"test" | "live">("test");
	const [templates, setTemplates] = useState<Template[]>([]);
	const [templateSearch, setTemplateSearch] = useState("");
	const [domains, setDomains] = useState<Domain[]>([]);
	const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
	const [selectedId, setSelectedId] = useState("");
	const [variables, setVariables] = useState<Record<string, string>>({});
	const [senderName, setSenderName] = useState("");
	const [fromLocal, setFromLocal] = useState("hello");
	const [fromDomain, setFromDomain] = useState("");
	const [to, setTo] = useState("");
	const [subject, setSubject] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [sending, setSending] = useState(false);
	const [result, setResult] = useState<{
		ok: boolean;
		message: string;
		isTest?: boolean;
		detail?: string;
	} | null>(null);
	const [previewHtml, setPreviewHtml] = useState("");
	const [previewSubject, setPreviewSubject] = useState("");
	const [rightTab, setRightTab] = useState<RightTab>("preview");
	const [snippetLang, setSnippetLang] = useState<SnippetLang>("curl");
	const [copied, setCopied] = useState(false);
	const [themeId, setThemeId] = useState("default");

	// Initial data loading
	useEffect(() => {
		Promise.all([
			api.get<Template[]>("/api/templates"),
			api.get<Domain[]>("/api/domains"),
			api.get<ApiKeyItem[]>("/api/keys").catch(() => ({ data: [] })),
		]).then(([{ data: tpl }, { data: dom }, { data: keys }]) => {
			setTemplates(tpl);
			const verified = dom.filter((d) => d.verified === 1);
			setDomains(verified);
			setApiKeys(keys || []);

			// Check URL parameters for prefill
			if (typeof window !== "undefined") {
				const params = new URLSearchParams(window.location.search);
				const fromParam = params.get("from");
				const toParam = params.get("to");
				const subjectParam = params.get("subject");
				const templateIdParam = params.get("templateId");

				if (fromParam && fromParam.includes("@")) {
					const [local, d] = fromParam.split("@");
					if (local) setFromLocal(local);
					if (d) setFromDomain(d);
				} else if (verified.length > 0) {
					setFromDomain(verified[0].name);
				}

				if (toParam) setTo(toParam);
				if (subjectParam) setSubject(subjectParam);

				if (templateIdParam) {
					setSelectedId(`t:${templateIdParam}`);
					const target = tpl.find((t) => t.id === templateIdParam);
					if (target && !subjectParam) setSubject(target.subject);
				} else if (tpl.length > 0) {
					// Select first template by default if none given
					setSelectedId(`t:${tpl[0].id}`);
					if (!subjectParam) setSubject(tpl[0].subject);
				}
			} else if (verified.length > 0) {
				setFromDomain(verified[0].name);
			}
		});
	}, []);

	const itemId = selectedId.startsWith("t:") ? selectedId.slice(2) : "";
	const hasTemplate = itemId !== "";

	const selectedTemplate = useMemo(
		() => (hasTemplate ? (templates.find((t) => t.id === itemId) ?? null) : null),
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
		setPreviewHtml("");
		setPreviewSubject("");
		setResult(null);
		if (id.startsWith("t:")) {
			const tpl = templates.find((t) => t.id === id.slice(2));
			if (tpl) setSubject(tpl.subject);
		} else {
			setSubject("");
		}
	}

	useEffect(() => {
		if (selectedTemplate && !subject) setSubject(selectedTemplate.subject);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedTemplate]);

	const fromAddress = fromLocal && fromDomain ? `${fromLocal}@${fromDomain}` : "";

	useEffect(() => {
		if (!selectedTemplate) {
			setPreviewHtml("");
			setPreviewSubject("");
			return;
		}
		if (selectedTemplate.layout) {
			api.post<{ html: string; subject: string }>(`/api/templates/${selectedTemplate.id}/preview`, {
				variables,
				themeId,
			})
				.then((r) => {
					setPreviewHtml(r.data.html);
					setPreviewSubject(r.data.subject);
				})
				.catch(() => setPreviewHtml('<p style="padding:1rem;color:red">Failed to render preview</p>'));
		} else {
			setPreviewHtml(applyVarsPreview(selectedTemplate.html_body, variables));
			setPreviewSubject(applyVarsPreview(selectedTemplate.subject, variables));
		}
	}, [selectedTemplate, variables, themeId]);

	const codePayload = useMemo(() => {
		const templateRef = selectedTemplate?.slug
			? { templateSlug: selectedTemplate.slug }
			: hasTemplate
				? { templateId: itemId }
				: {};
		const obj: Record<string, unknown> = {
			from: fromAddress || "hello@yourdomain.com",
			...(senderName ? { fromName: senderName } : {}),
			to: to || "recipient@example.com",
			...(subject ? { subject } : {}),
			...templateRef,
			themeId,
			variables:
				Object.keys(variables).length > 0
					? variables
					: detectedVars.reduce((acc, v) => ({ ...acc, [v]: `<${v}>` }), {}),
		};
		if (Object.keys(obj.variables as object).length === 0) delete obj.variables;
		return JSON.stringify(obj, null, 2);
	}, [fromAddress, senderName, to, subject, hasTemplate, itemId, selectedTemplate, themeId, variables, detectedVars]);

	// Code snippets for each language
	const authPlaceholder =
		deliveryMode === "test" ? apiKey || "eftest_your_test_key" : apiKey || "eflive_your_live_key";

	const curlSnippet = useMemo(
		() =>
			`curl -X POST https://your-emailflare.com/v1/send \\\n  -H "Authorization: Bearer ${authPlaceholder}" \\\n  -H "Content-Type: application/json" \\\n  -d '${codePayload}'`,
		[authPlaceholder, codePayload],
	);

	const tsSnippet = useMemo(
		() =>
			`import fetch from "node-fetch"; // or browser native fetch\n\nconst payload = ${codePayload};\n\nconst response = await fetch("https://your-emailflare.com/v1/send", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer ${authPlaceholder}",\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(payload),\n});\n\nconst data = await response.json();\nconsole.log(data);`,
		[authPlaceholder, codePayload],
	);

	const pythonSnippet = useMemo(
		() =>
			`import requests\n\nurl = "https://your-emailflare.com/v1/send"\nheaders = {\n    "Authorization": "Bearer ${authPlaceholder}",\n    "Content-Type": "application/json"\n}\npayload = ${codePayload}\n\nresponse = requests.post(url, json=payload, headers=headers)\nprint(response.json())`,
		[authPlaceholder, codePayload],
	);

	const currentSnippet =
		snippetLang === "curl" ? curlSnippet : snippetLang === "typescript" ? tsSnippet : pythonSnippet;

	function handleCopySnippet() {
		navigator.clipboard.writeText(currentSnippet);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	const systemTemplates = templates.filter((t) => t.is_system === 1);
	const customTemplates = templates.filter((t) => t.is_system === 0);
	const tq = templateSearch.trim().toLowerCase();
	const filteredSystemTemplates = systemTemplates.filter((t) => {
		if (!tq) return true;
		return (
			t.name.toLowerCase().includes(tq) ||
			(t.slug ?? "").toLowerCase().includes(tq) ||
			t.subject.toLowerCase().includes(tq)
		);
	});
	const filteredCustomTemplates = customTemplates.filter((t) => {
		if (!tq) return true;
		return (
			t.name.toLowerCase().includes(tq) ||
			(t.slug ?? "").toLowerCase().includes(tq) ||
			t.subject.toLowerCase().includes(tq)
		);
	});

	const templateItems = templates.map((t) => ({ value: `t:${t.id}`, label: t.name }));
	const domainItems = domains.map((d) => ({ value: d.name, label: d.name }));
	const apiKeyItems = apiKeys.map((k) => ({
		value: k.key_prefix,
		label: `${k.name} (${k.key_prefix}...) [${k.key_type}]`,
	}));

	async function handleSend(e: React.FormEvent) {
		e.preventDefault();
		if (!selectedTemplate || !fromAddress || !to) return;
		setResult(null);
		setSending(true);

		try {
			const res = await sendPlaygroundEmail({
				from: fromAddress,
				fromName: senderName || undefined,
				to,
				subject: subject || undefined,
				templateId: selectedTemplate.id,
				templateSlug: selectedTemplate.slug || undefined,
				variables: Object.keys(variables).length > 0 ? variables : undefined,
				themeId,
				mode: deliveryMode,
				apiKey: deliveryMode === "live" ? apiKey : undefined,
			});

			if (res.ok) {
				if (deliveryMode === "test") {
					setResult({
						ok: true,
						isTest: true,
						message: "Captured in Test Mailbox!",
						detail: "Your test email was captured safely in the sandbox and did not hit external inboxes.",
					});
				} else {
					setResult({
						ok: true,
						isTest: false,
						message: "Live email delivered!",
						detail: `Dispatched via Cloudflare Email Routing (Message ID: ${res.messageId || "ok"}).`,
					});
				}
			} else {
				setResult({
					ok: false,
					message: "Failed to send email",
					detail: res.error || "Unknown server error",
				});
			}
		} catch (err: unknown) {
			const e2 = err as { response?: { data?: { error?: unknown }; status?: number } };
			const raw = e2.response?.data?.error;
			const detail =
				typeof raw === "string"
					? raw
					: raw != null
						? JSON.stringify(raw)
						: `HTTP ${e2.response?.status ?? "unknown"}`;
			setResult({ ok: false, message: "Failed to send.", detail });
		} finally {
			setSending(false);
		}
	}

	return (
		<div className="flex h-full flex-col overflow-hidden bg-background">
			{/* Top Header */}
			<div className="shrink-0 border-b border-border bg-background px-6 py-4">
				<PageHeader
					title="Playground"
					description="Test, preview, and generate client code for your transactional email templates."
					actions={
						<Link href="/inbox?folder=test" className={buttonVariants({ variant: "outline", size: "sm" })}>
							<FlaskConical />
							<span>Open Test Mailbox</span>
						</Link>
					}
				/>
			</div>

			{/* Main Two-Column Layout */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left Panel: Configuration Form */}
				<ScrollArea className="w-[440px] shrink-0 border-r border-border bg-background">
					<div className="flex flex-col gap-4 p-5">
						{/* Delivery Destination Segmented Toggle */}
						<div className="flex flex-col gap-1.5">
							<Label className="text-xs font-semibold text-foreground">Delivery Destination</Label>
							<ToggleGroup
								value={[deliveryMode]}
								onValueChange={(v) => {
									if (v[0] === "test" || v[0] === "live") {
										setDeliveryMode(v[0]);
										setResult(null);
									}
								}}
								spacing={2}
								className="grid w-full grid-cols-2 rounded-xl border border-border bg-muted/40 p-1"
							>
								<ToggleGroupItem
									value="test"
									className="h-auto justify-start gap-2 border border-transparent p-2 text-left text-muted-foreground hover:bg-transparent aria-pressed:border-info/40 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
								>
									<div
										className={cn(
											"flex size-7 shrink-0 items-center justify-center rounded-md",
											deliveryMode === "test"
												? "bg-info-muted text-info-muted-foreground"
												: "bg-muted text-muted-foreground",
										)}
									>
										<FlaskConical className="size-3.5" />
									</div>
									<div className="min-w-0">
										<div className="text-xs leading-tight font-semibold">Test Sandbox</div>
										<div className="truncate text-2xs font-normal text-muted-foreground">
											No API key required
										</div>
									</div>
								</ToggleGroupItem>

								<ToggleGroupItem
									value="live"
									className="h-auto justify-start gap-2 border border-transparent p-2 text-left text-muted-foreground hover:bg-transparent aria-pressed:border-primary/40 aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-xs"
								>
									<div
										className={cn(
											"flex size-7 shrink-0 items-center justify-center rounded-md",
											deliveryMode === "live"
												? "bg-primary-muted text-primary-muted-foreground"
												: "bg-muted text-muted-foreground",
										)}
									>
										<Zap className="size-3.5" />
									</div>
									<div className="min-w-0">
										<div className="text-xs leading-tight font-semibold">Live Recipient</div>
										<div className="truncate text-2xs font-normal text-muted-foreground">
											Cloudflare send
										</div>
									</div>
								</ToggleGroupItem>
							</ToggleGroup>
						</div>

						{/* Template Selector Card */}
						<div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
							<div className="flex items-center justify-between">
								<p className="text-xs font-semibold text-foreground">Select Template</p>
								<ThemePicker value={themeId} onChange={setThemeId} />
							</div>

							<InputGroup className="h-8">
								<InputGroupAddon>
									<Search className="size-4" />
								</InputGroupAddon>
								<InputGroupInput
									value={templateSearch}
									onChange={(e) => setTemplateSearch(e.target.value)}
									placeholder="Search templates..."
									className="text-xs"
								/>
							</InputGroup>

							<Select
								items={templateItems}
								value={selectedId}
								onValueChange={(v) => v !== null && handleSelect(v)}
							>
								<SelectTrigger className="w-full text-xs">
									<SelectValue placeholder="— Select a template —" />
								</SelectTrigger>
								<SelectContent>
									{filteredSystemTemplates.length > 0 && (
										<SelectGroup>
											<SelectLabel className="text-2xs tracking-wider text-muted-foreground uppercase">
												Built-in templates ({filteredSystemTemplates.length})
											</SelectLabel>
											{filteredSystemTemplates.map((t) => (
												<SelectItem key={t.id} value={`t:${t.id}`} className="text-xs">
													{t.name}
												</SelectItem>
											))}
										</SelectGroup>
									)}
									{filteredCustomTemplates.length > 0 && (
										<SelectGroup>
											<SelectLabel className="text-2xs tracking-wider text-muted-foreground uppercase">
												Custom templates ({filteredCustomTemplates.length})
											</SelectLabel>
											{filteredCustomTemplates.map((t) => (
												<SelectItem key={t.id} value={`t:${t.id}`} className="text-xs">
													{t.name}
												</SelectItem>
											))}
										</SelectGroup>
									)}
								</SelectContent>
							</Select>
						</div>

						{/* Template Variables Form */}
						{detectedVars.length > 0 && (
							<div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card p-4">
								<p className="text-xs font-semibold text-foreground">Template Variables</p>
								<div className="flex flex-col gap-2">
									{detectedVars.map((v) => (
										<div key={v} className="flex flex-col gap-1">
											<Label className="font-mono text-2xs text-muted-foreground">{`{{${v}}}`}</Label>
											<Input
												value={variables[v] ?? ""}
												onChange={(e) =>
													setVariables((prev) => ({ ...prev, [v]: e.target.value }))
												}
												placeholder={`Value for ${v}...`}
												className="font-mono text-xs"
											/>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Delivery Parameters Card */}
						<form
							onSubmit={handleSend}
							className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
						>
							<p className="text-xs font-semibold text-foreground">Delivery Parameters</p>

							{/* Sender Name */}
							<div className="flex flex-col gap-1">
								<Label className="text-2xs text-muted-foreground">Sender Name (optional)</Label>
								<Input
									value={senderName}
									onChange={(e) => setSenderName(e.target.value)}
									placeholder="Acme Notifications"
									className="text-xs"
								/>
							</div>

							{/* From Address */}
							<div className="flex flex-col gap-1">
								<Label className="text-2xs text-muted-foreground">From Address</Label>
								<div className="flex items-center gap-1.5">
									<Input
										value={fromLocal}
										onChange={(e) => setFromLocal(e.target.value)}
										placeholder="hello"
										className="min-w-0 flex-1 font-mono text-xs"
									/>
									<span className="shrink-0 text-xs text-muted-foreground">@</span>
									{domains.length > 0 ? (
										<Select
											items={domainItems}
											value={fromDomain}
											onValueChange={(v) => v !== null && setFromDomain(v)}
										>
											<SelectTrigger className="min-w-0 flex-1 font-mono text-xs">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{domains.map((d) => (
													<SelectItem key={d.id} value={d.name} className="font-mono text-xs">
														{d.name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									) : (
										<Input
											value={fromDomain}
											onChange={(e) => setFromDomain(e.target.value)}
											placeholder="yourdomain.com"
											className="min-w-0 flex-1 font-mono text-xs"
										/>
									)}
								</div>
							</div>

							{/* Recipient */}
							<div className="flex flex-col gap-1">
								<Label className="text-2xs text-muted-foreground">To (Recipient)</Label>
								<Input
									type="email"
									value={to}
									onChange={(e) => setTo(e.target.value)}
									placeholder={deliveryMode === "test" ? "sandbox@example.com" : "you@example.com"}
									className="font-mono text-xs"
									required
								/>
							</div>

							{/* Subject */}
							<div className="flex flex-col gap-1">
								<Label className="text-2xs text-muted-foreground">Subject Line</Label>
								<Input
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
									placeholder="Email subject..."
									className="text-xs"
									required
								/>
							</div>

							{/* API Key (Only in Live Mode) */}
							{deliveryMode === "live" && (
								<div className="flex flex-col gap-1 border-t border-border/80 pt-1">
									<div className="flex items-center justify-between">
										<Label className="text-2xs font-medium text-foreground">
											API Key (Required for live send)
										</Label>
										<span className="font-mono text-2xs text-primary">Bearer Auth</span>
									</div>
									{apiKeys.length > 0 && (
										<Select
											items={apiKeyItems}
											onValueChange={(val) => {
												if (typeof val === "string") setApiKey(val);
											}}
										>
											<SelectTrigger className="w-full font-mono text-xs">
												<SelectValue placeholder="— Pick an active API key —" />
											</SelectTrigger>
											<SelectContent>
												{apiKeys.map((k) => (
													<SelectItem
														key={k.id}
														value={k.key_prefix}
														className="font-mono text-xs"
													>
														{k.name} ({k.key_prefix}...) [{k.key_type}]
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									)}
									<Input
										type="password"
										value={apiKey}
										onChange={(e) => setApiKey(e.target.value)}
										placeholder="eflive_... or eftest_..."
										className="font-mono text-xs"
										required={deliveryMode === "live"}
									/>
								</div>
							)}

							{/* Result Feedback Banner */}
							{result && (
								<div className="pt-1">
									{result.ok && result.isTest ? (
										<Alert variant="info" className="p-3.5">
											<AlertDescription className="flex flex-col gap-2 text-info-muted-foreground">
												<div className="flex items-center gap-1.5 text-xs font-semibold">
													<FlaskConical className="size-3.5" />
													<span>Captured in Test Mailbox!</span>
												</div>
												<p className="text-2xs leading-relaxed text-muted-foreground">
													Your test email was captured safely in the sandbox and did not hit
													external inboxes.
												</p>
												<div className="pt-0.5">
													<Link
														href="/inbox?folder=test"
														className={buttonVariants({ variant: "default", size: "sm" })}
													>
														<span>View in Test Mailbox</span>
														<ArrowRight className="size-3" />
													</Link>
												</div>
											</AlertDescription>
										</Alert>
									) : (
										<Alert variant={result.ok ? "success" : "destructive"}>
											<AlertDescription className="flex items-start gap-2 text-xs">
												{result.ok ? (
													<CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
												) : (
													<XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
												)}
												<div>
													<div className="font-semibold">{result.message}</div>
													{result.detail && (
														<div className="mt-0.5 text-2xs opacity-80">
															{result.detail}
														</div>
													)}
												</div>
											</AlertDescription>
										</Alert>
									)}
								</div>
							)}

							{/* Send Action Button */}
							<Button
								type="submit"
								disabled={
									!selectedTemplate ||
									!fromAddress ||
									!to ||
									sending ||
									(deliveryMode === "live" && !apiKey)
								}
								className={cn(
									"h-9 w-full gap-2 text-xs font-medium shadow-xs",
									deliveryMode === "test" && "bg-info text-primary-foreground hover:bg-info/90",
								)}
							>
								{sending ? (
									<>
										<Spinner className="size-3.5" />
										<span>
											{deliveryMode === "test" ? "Capturing in Sandbox..." : "Delivering..."}
										</span>
									</>
								) : deliveryMode === "test" ? (
									<>
										<FlaskConical className="size-3.5" />
										<span>Send to Sandbox (Test Mailbox)</span>
									</>
								) : (
									<>
										<Send className="size-3.5" />
										<span>Dispatch Live Email</span>
									</>
								)}
							</Button>
						</form>
					</div>
				</ScrollArea>

				{/* Right Panel: Tabbed Preview & Code Inspection */}
				<Tabs
					value={rightTab}
					onValueChange={(v) => setRightTab(v as RightTab)}
					className="flex flex-1 flex-col overflow-hidden bg-background"
				>
					<div className="shrink-0 overflow-x-auto border-b border-border bg-muted/20 px-4">
						<TabsList variant="line" className="h-10 w-max gap-1 p-0">
							<TabsTrigger value="preview" className="h-10 rounded-none px-3 text-xs after:bg-primary">
								<Eye className="size-3.5" />
								<span>Live Preview</span>
							</TabsTrigger>
							<TabsTrigger value="code" className="h-10 rounded-none px-3 text-xs after:bg-primary">
								<Code2 className="size-3.5" />
								<span>Template Source</span>
							</TabsTrigger>
							<TabsTrigger value="snippets" className="h-10 rounded-none px-3 text-xs after:bg-primary">
								<Terminal className="size-3.5" />
								<span>Code Snippets</span>
							</TabsTrigger>
							<TabsTrigger value="api" className="h-10 rounded-none px-3 text-xs after:bg-primary">
								<BookOpen className="size-3.5" />
								<span>Payload & Docs</span>
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-hidden">
						{/* Tab 1: Live Preview */}
						<TabsContent value="preview" className="m-0 h-full data-[state=inactive]:hidden">
							{previewHtml ? (
								<iframe
									srcDoc={previewHtml}
									className="h-full w-full border-0 bg-white"
									sandbox="allow-same-origin"
									title="Email preview"
								/>
							) : (
								<Empty className="h-full select-none">
									<EmptyHeader>
										<EmptyMedia variant="icon">
											<Mail />
										</EmptyMedia>
										<EmptyTitle className="text-xs font-normal text-muted-foreground">
											Select a template to generate live preview
										</EmptyTitle>
									</EmptyHeader>
								</Empty>
							)}
						</TabsContent>

						{/* Tab 2: Template Code */}
						<TabsContent value="code" className="m-0 h-full overflow-y-auto data-[state=inactive]:hidden">
							<div className="flex flex-col gap-4 p-6">
								{selectedTemplate ? (
									<>
										<div className="flex items-center gap-2">
											<Badge
												variant={selectedTemplate.is_system === 1 ? "info" : "warning"}
												className="font-mono text-2xs uppercase"
											>
												{selectedTemplate.is_system === 1
													? "Built-in Layout"
													: "Custom Template"}
											</Badge>
											<span className="text-xs text-muted-foreground">
												{selectedTemplate.layout
													? `Rendered server-side using React Email (${selectedTemplate.layout})`
													: "Standard HTML template"}
											</span>
										</div>

										<div>
											<p className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
												Subject Line
											</p>
											<pre className="rounded-xl border border-border bg-muted/40 px-4 py-2.5 font-mono text-xs text-foreground">
												{previewSubject || selectedTemplate.subject}
											</pre>
										</div>

										<div>
											<p className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
												Rendered HTML Output
											</p>
											<SyntaxCode code={previewHtml || selectedTemplate.html_body} lang="html" />
										</div>

										{selectedTemplate.text_body && (
											<div>
												<p className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
													Plain Text Body
												</p>
												<pre className="rounded-xl border border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
													{selectedTemplate.text_body}
												</pre>
											</div>
										)}
									</>
								) : (
									<Empty className="h-full select-none">
										<EmptyHeader>
											<EmptyMedia variant="icon">
												<Code2 />
											</EmptyMedia>
											<EmptyTitle className="text-xs font-normal text-muted-foreground">
												Select a template to view source
											</EmptyTitle>
										</EmptyHeader>
									</Empty>
								)}
							</div>
						</TabsContent>

						{/* Tab 3: Code Snippets (Multi-language) */}
						<TabsContent
							value="snippets"
							className="m-0 h-full overflow-y-auto data-[state=inactive]:hidden"
						>
							<div className="flex flex-col gap-4 p-6">
								<div className="flex items-center justify-between">
									<ToggleGroup
										value={[snippetLang]}
										onValueChange={(v) => v[0] && setSnippetLang(v[0] as SnippetLang)}
										variant="outline"
										size="sm"
										spacing={0}
									>
										<ToggleGroupItem value="curl">cURL</ToggleGroupItem>
										<ToggleGroupItem value="typescript">TypeScript / Node</ToggleGroupItem>
										<ToggleGroupItem value="python">Python</ToggleGroupItem>
									</ToggleGroup>

									<Button
										variant="outline"
										size="sm"
										onClick={handleCopySnippet}
										className="gap-1.5 text-xs"
									>
										{copied ? (
											<Check className="size-3 text-success" />
										) : (
											<Copy className="size-3" />
										)}
										<span>{copied ? "Copied!" : "Copy Code"}</span>
									</Button>
								</div>

								<div className="relative">
									<SyntaxCode
										code={currentSnippet}
										lang={
											snippetLang === "curl"
												? "bash"
												: snippetLang === "typescript"
													? "typescript"
													: "python"
										}
									/>
								</div>

								<div className="space-y-1.5 rounded-xl border border-border bg-muted/10 p-4 text-xs text-muted-foreground">
									<p className="font-semibold text-foreground">API Delivery Note:</p>
									<p>
										Sending with an API key with prefix{" "}
										<code className="font-mono text-info">eftest_</code> will automatically capture
										into the in-house Sandbox (Test Mailbox) without real delivery. Keys with prefix{" "}
										<code className="font-mono text-primary">eflive_</code> deliver live via
										Cloudflare.
									</p>
								</div>
							</div>
						</TabsContent>

						{/* Tab 4: API Payload & Docs */}
						<TabsContent value="api" className="m-0 h-full overflow-y-auto data-[state=inactive]:hidden">
							<div className="flex flex-col gap-5 p-6">
								<div>
									<p className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
										Full JSON Request Payload
									</p>
									<SyntaxCode code={codePayload} lang="json" />
								</div>

								<div>
									<p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
										Request Fields Breakdown
									</p>
									<div className="rounded-xl border border-border bg-card px-2">
										<Table>
											<TableBody>
												{(
													[
														{ field: "from", value: fromAddress || null },
														{ field: "fromName", value: senderName || null },
														{ field: "to", value: to || null },
														{ field: "subject", value: subject || null },
														selectedTemplate
															? {
																	field: selectedTemplate.slug
																		? "templateSlug"
																		: "templateId",
																	value: selectedTemplate.slug ?? selectedTemplate.id,
																}
															: null,
														{ field: "themeId", value: themeId },
														...detectedVars.map((v) => ({
															field: `variables.${v}`,
															value: variables[v] || null,
														})),
													].filter(Boolean) as Array<{ field: string; value: string | null }>
												).map(({ field, value }) => (
													<TableRow key={field}>
														<TableCell className="font-mono text-xs text-primary">
															{field}
														</TableCell>
														<TableCell
															className={cn(
																"max-w-xs truncate text-right text-xs",
																value
																	? "font-mono text-foreground"
																	: "text-muted-foreground italic",
															)}
														>
															{value ?? "not set"}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</div>
							</div>
						</TabsContent>
					</div>
				</Tabs>
			</div>
		</div>
	);
}
