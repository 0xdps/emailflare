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
	RefreshCw,
} from "lucide-react";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import jsonLang from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import "highlight.js/styles/github.min.css";
import api, { sendPlaygroundEmail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
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
		<div className="flex items-center gap-1.5 flex-wrap">
			<span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Theme</span>
			{EMAIL_THEMES.map((t) => (
				<button
					key={t.id}
					type="button"
					title={t.label}
					onClick={() => onChange(t.id)}
					className={cn(
						"size-4 rounded-full border-2 transition-all duration-100",
						value === t.id
							? "border-white scale-125 shadow-sm"
							: "border-transparent opacity-50 hover:opacity-90 hover:scale-110",
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
				'<span style="color:#fb923c;background:rgba(251,146,60,.15);border-radius:3px;padding:0 2px">{{$1}}</span>',
			);
		} catch {
			return code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
		}
	}, [code, lang]);

	return (
		<pre
			className={`hljs rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed border border-border p-4 ${className}`}
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
		<div className="flex flex-col h-full bg-background overflow-hidden">
			{/* Top Header */}
			<div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-background">
				<div>
					<h1 className="text-base font-semibold tracking-tight text-foreground">Playground</h1>
					<p className="text-xs text-muted-foreground mt-0.5">
						Test, preview, and generate client code for your transactional email templates.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Link
						href="/inbox?folder=test"
						className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs font-medium hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors"
					>
						<FlaskConical size={13} />
						<span>Open Test Mailbox</span>
					</Link>
				</div>
			</div>

			{/* Main Two-Column Layout */}
			<div className="flex flex-1 overflow-hidden">
				{/* Left Panel: Configuration Form */}
				<ScrollArea className="w-[440px] shrink-0 border-r border-border bg-background">
					<div className="p-5 flex flex-col gap-4">
						{/* Delivery Destination Segmented Toggle */}
						<div className="flex flex-col gap-1.5">
							<Label className="text-xs font-semibold text-foreground">Delivery Destination</Label>
							<div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-muted/40 border border-border">
								<button
									type="button"
									onClick={() => {
										setDeliveryMode("test");
										setResult(null);
									}}
									className={cn(
										"flex items-center gap-2 p-2 rounded-lg text-left transition-all",
										deliveryMode === "test"
											? "bg-background text-foreground shadow-xs border border-purple-300/50 dark:border-purple-700/50 font-medium"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									<div
										className={cn(
											"size-7 rounded-md flex items-center justify-center shrink-0",
											deliveryMode === "test"
												? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300"
												: "bg-muted text-muted-foreground",
										)}
									>
										<FlaskConical size={14} />
									</div>
									<div className="min-w-0">
										<div className="text-xs font-semibold leading-tight">Test Sandbox</div>
										<div className="text-[10px] text-muted-foreground truncate">
											No API key required
										</div>
									</div>
								</button>

								<button
									type="button"
									onClick={() => {
										setDeliveryMode("live");
										setResult(null);
									}}
									className={cn(
										"flex items-center gap-2 p-2 rounded-lg text-left transition-all",
										deliveryMode === "live"
											? "bg-background text-foreground shadow-xs border border-orange-300/50 dark:border-orange-700/50 font-medium"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									<div
										className={cn(
											"size-7 rounded-md flex items-center justify-center shrink-0",
											deliveryMode === "live"
												? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
												: "bg-muted text-muted-foreground",
										)}
									>
										<Zap size={14} />
									</div>
									<div className="min-w-0">
										<div className="text-xs font-semibold leading-tight">Live Recipient</div>
										<div className="text-[10px] text-muted-foreground truncate">
											Cloudflare send
										</div>
									</div>
								</button>
							</div>
						</div>

						{/* Template Selector Card */}
						<div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
							<div className="flex items-center justify-between">
								<p className="text-xs font-semibold text-foreground">Select Template</p>
								<ThemePicker value={themeId} onChange={setThemeId} />
							</div>

							<Input
								value={templateSearch}
								onChange={(e) => setTemplateSearch(e.target.value)}
								placeholder="Search templates..."
								className="h-8 text-xs"
							/>

							<Select value={selectedId} onValueChange={(v) => v !== null && handleSelect(v)}>
								<SelectTrigger className="w-full h-8.5 text-xs">
									<SelectValue placeholder="— Select a template —">
										{selectedTemplate ? selectedTemplate.name : undefined}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{filteredSystemTemplates.length > 0 && (
										<SelectGroup>
											<SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
											<SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
							<div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2.5">
								<p className="text-xs font-semibold text-foreground">Template Variables</p>
								<div className="flex flex-col gap-2">
									{detectedVars.map((v) => (
										<div key={v} className="flex flex-col gap-1">
											<Label className="text-[11px] font-mono text-muted-foreground">{`{{${v}}}`}</Label>
											<Input
												value={variables[v] ?? ""}
												onChange={(e) =>
													setVariables((prev) => ({ ...prev, [v]: e.target.value }))
												}
												placeholder={`Value for ${v}...`}
												className="h-7.5 text-xs font-mono"
											/>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Delivery Parameters Card */}
						<form
							onSubmit={handleSend}
							className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3"
						>
							<p className="text-xs font-semibold text-foreground">Delivery Parameters</p>

							{/* Sender Name */}
							<div className="flex flex-col gap-1">
								<Label className="text-[11px] text-muted-foreground">Sender Name (optional)</Label>
								<Input
									value={senderName}
									onChange={(e) => setSenderName(e.target.value)}
									placeholder="Acme Notifications"
									className="h-8 text-xs"
								/>
							</div>

							{/* From Address */}
							<div className="flex flex-col gap-1">
								<Label className="text-[11px] text-muted-foreground">From Address</Label>
								<div className="flex gap-1.5 items-center">
									<Input
										value={fromLocal}
										onChange={(e) => setFromLocal(e.target.value)}
										placeholder="hello"
										className="flex-1 min-w-0 h-8 text-xs font-mono"
									/>
									<span className="text-muted-foreground text-xs shrink-0">@</span>
									{domains.length > 0 ? (
										<Select
											value={fromDomain}
											onValueChange={(v) => v !== null && setFromDomain(v)}
										>
											<SelectTrigger className="flex-1 min-w-0 h-8 text-xs font-mono">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{domains.map((d) => (
													<SelectItem key={d.id} value={d.name} className="text-xs font-mono">
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
											className="flex-1 min-w-0 h-8 text-xs font-mono"
										/>
									)}
								</div>
							</div>

							{/* Recipient */}
							<div className="flex flex-col gap-1">
								<Label className="text-[11px] text-muted-foreground">To (Recipient)</Label>
								<Input
									type="email"
									value={to}
									onChange={(e) => setTo(e.target.value)}
									placeholder={deliveryMode === "test" ? "sandbox@example.com" : "you@example.com"}
									className="h-8 text-xs font-mono"
									required
								/>
							</div>

							{/* Subject */}
							<div className="flex flex-col gap-1">
								<Label className="text-[11px] text-muted-foreground">Subject Line</Label>
								<Input
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
									placeholder="Email subject..."
									className="h-8 text-xs"
									required
								/>
							</div>

							{/* API Key (Only in Live Mode) */}
							{deliveryMode === "live" && (
								<div className="flex flex-col gap-1 pt-1 border-t border-border/80">
									<div className="flex items-center justify-between">
										<Label className="text-[11px] text-foreground font-medium">
											API Key (Required for live send)
										</Label>
										<span className="text-[10px] text-orange-600 dark:text-orange-400 font-mono">
											Bearer Auth
										</span>
									</div>
									{apiKeys.length > 0 && (
										<Select
											onValueChange={(val) => {
												if (typeof val === "string") setApiKey(val);
											}}
										>
											<SelectTrigger className="w-full h-7.5 text-xs font-mono">
												<SelectValue placeholder="— Pick an active API key —" />
											</SelectTrigger>
											<SelectContent>
												{apiKeys.map((k) => (
													<SelectItem
														key={k.id}
														value={k.key_prefix}
														className="text-xs font-mono"
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
										className="h-8 text-xs font-mono"
										required={deliveryMode === "live"}
									/>
								</div>
							)}

							{/* Result Feedback Banner */}
							{result && (
								<div className="pt-1">
									{result.ok && result.isTest ? (
										<div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/70 dark:bg-purple-950/30 p-3.5 space-y-2">
											<div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-semibold text-xs">
												<FlaskConical size={14} />
												<span>Captured in Test Mailbox!</span>
											</div>
											<p className="text-[11px] text-muted-foreground leading-relaxed">
												Your test email was captured safely in the sandbox and did not hit
												external inboxes.
											</p>
											<div className="pt-0.5">
												<Link
													href="/inbox?folder=test"
													className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors"
												>
													<span>View in Test Mailbox</span>
													<ArrowRight size={12} />
												</Link>
											</div>
										</div>
									) : (
										<Alert
											className={cn(
												result.ok
													? "border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
													: "border-destructive/20 bg-destructive/10 text-destructive",
											)}
										>
											<AlertDescription className="flex items-start gap-2 text-xs">
												{result.ok ? (
													<CheckCircle2
														size={13}
														className="shrink-0 mt-0.5 text-emerald-500"
													/>
												) : (
													<XCircle size={13} className="shrink-0 mt-0.5 text-destructive" />
												)}
												<div>
													<div className="font-semibold">{result.message}</div>
													{result.detail && (
														<div className="opacity-80 text-[11px] mt-0.5">
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
									"w-full gap-2 text-xs h-9 font-medium shadow-xs",
									deliveryMode === "test"
										? "bg-purple-600 hover:bg-purple-700 text-white"
										: "bg-orange-600 hover:bg-orange-700 text-white",
								)}
							>
								{sending ? (
									<>
										<RefreshCw size={13} className="animate-spin" />
										<span>
											{deliveryMode === "test" ? "Capturing in Sandbox..." : "Delivering..."}
										</span>
									</>
								) : deliveryMode === "test" ? (
									<>
										<FlaskConical size={14} />
										<span>Send to Sandbox (Test Mailbox)</span>
									</>
								) : (
									<>
										<Send size={13} />
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
					className="flex-1 flex flex-col overflow-hidden bg-background"
				>
					<div className="border-b border-border shrink-0 px-4 bg-muted/20">
						<TabsList className="bg-transparent h-10 gap-2 p-0">
							<TabsTrigger
								value="preview"
								className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
							>
								<Eye size={13} />
								<span>Live Preview</span>
							</TabsTrigger>
							<TabsTrigger
								value="code"
								className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
							>
								<Code2 size={13} />
								<span>Template Source</span>
							</TabsTrigger>
							<TabsTrigger
								value="snippets"
								className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
							>
								<Terminal size={13} />
								<span>Code Snippets</span>
							</TabsTrigger>
							<TabsTrigger
								value="api"
								className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none h-10 px-3 text-xs gap-1.5"
							>
								<BookOpen size={13} />
								<span>Payload & Docs</span>
							</TabsTrigger>
						</TabsList>
					</div>

					<div className="flex-1 overflow-hidden">
						{/* Tab 1: Live Preview */}
						<TabsContent value="preview" className="h-full m-0 data-[state=inactive]:hidden">
							{previewHtml ? (
								<iframe
									srcDoc={previewHtml}
									className="w-full h-full border-0 bg-white"
									sandbox="allow-same-origin"
									title="Email preview"
								/>
							) : (
								<div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground select-none">
									<Mail size={36} strokeWidth={1.25} />
									<p className="text-xs">Select a template to generate live preview</p>
								</div>
							)}
						</TabsContent>

						{/* Tab 2: Template Code */}
						<TabsContent value="code" className="h-full m-0 data-[state=inactive]:hidden overflow-y-auto">
							<div className="p-6 flex flex-col gap-4">
								{selectedTemplate ? (
									<>
										<div className="flex items-center gap-2">
											<Badge
												variant="secondary"
												className={cn(
													"text-[10px] uppercase font-mono",
													selectedTemplate.is_system === 1
														? "text-purple-700 bg-purple-100 dark:bg-purple-950 dark:text-purple-300"
														: "text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300",
												)}
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
											<p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
												Subject Line
											</p>
											<pre className="bg-muted/40 border border-border rounded-xl px-4 py-2.5 text-xs font-mono text-foreground">
												{previewSubject || selectedTemplate.subject}
											</pre>
										</div>

										<div>
											<p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
												Rendered HTML Output
											</p>
											<SyntaxCode code={previewHtml || selectedTemplate.html_body} lang="html" />
										</div>

										{selectedTemplate.text_body && (
											<div>
												<p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
													Plain Text Body
												</p>
												<pre className="bg-muted/40 border border-border rounded-xl p-4 text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
													{selectedTemplate.text_body}
												</pre>
											</div>
										)}
									</>
								) : (
									<div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground py-20 select-none">
										<Code2 size={36} strokeWidth={1.25} />
										<p className="text-xs">Select a template to view source</p>
									</div>
								)}
							</div>
						</TabsContent>

						{/* Tab 3: Code Snippets (Multi-language) */}
						<TabsContent
							value="snippets"
							className="h-full m-0 data-[state=inactive]:hidden overflow-y-auto"
						>
							<div className="p-6 flex flex-col gap-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/40 border border-border">
										{(
											[
												{ id: "curl", label: "cURL" },
												{ id: "typescript", label: "TypeScript / Node" },
												{ id: "python", label: "Python" },
											] as const
										).map(({ id, label }) => (
											<button
												key={id}
												type="button"
												onClick={() => setSnippetLang(id)}
												className={cn(
													"px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
													snippetLang === id
														? "bg-background text-foreground shadow-xs font-semibold"
														: "text-muted-foreground hover:text-foreground",
												)}
											>
												{label}
											</button>
										))}
									</div>

									<Button
										variant="outline"
										size="sm"
										onClick={handleCopySnippet}
										className="h-8 gap-1.5 text-xs"
									>
										{copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
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

								<div className="rounded-xl border border-border p-4 bg-muted/10 text-xs space-y-1.5 text-muted-foreground">
									<p className="font-semibold text-foreground">API Delivery Note:</p>
									<p>
										Sending with an API key with prefix{" "}
										<code className="text-purple-600 font-mono">eftest_</code> will automatically
										capture into the in-house Sandbox (Test Mailbox) without real delivery. Keys
										with prefix <code className="text-orange-600 font-mono">eflive_</code> deliver
										live via Cloudflare.
									</p>
								</div>
							</div>
						</TabsContent>

						{/* Tab 4: API Payload & Docs */}
						<TabsContent value="api" className="h-full m-0 data-[state=inactive]:hidden overflow-y-auto">
							<div className="p-6 flex flex-col gap-5">
								<div>
									<p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-1.5">
										Full JSON Request Payload
									</p>
									<SyntaxCode code={codePayload} lang="json" />
								</div>

								<div>
									<p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-2">
										Request Fields Breakdown
									</p>
									<div className="bg-card border border-border rounded-xl divide-y divide-border">
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
											<div
												key={field}
												className="flex items-center justify-between px-4 py-2.5 text-xs"
											>
												<code className="font-mono text-primary">{field}</code>
												<span
													className={
														value
															? "text-foreground font-mono max-w-xs truncate text-right"
															: "text-muted-foreground italic"
													}
												>
													{value ?? "not set"}
												</span>
											</div>
										))}
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
