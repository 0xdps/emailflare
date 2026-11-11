"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EVENTS = ["email.sent", "email.failed", "email.opened", "email.clicked", "email.bounced"];

interface Webhook {
	id: string;
	url: string;
	events: string;
	active: number;
}

export default function WebhooksPage() {
	const [hooks, setHooks] = useState<Webhook[]>([]);
	const [url, setUrl] = useState("");
	const [events, setEvents] = useState<string[]>(["email.sent", "email.failed"]);
	const [secret, setSecret] = useState<string | null>(null);

	async function load() {
		const { data } = await api.get<Webhook[]>("/api/webhooks");
		setHooks(data.filter((hook) => hook.active));
	}

	useEffect(() => {
		load().catch(() => setHooks([]));
	}, []);

	return (
		<div className="mx-auto max-w-3xl space-y-6 p-6 md:p-8">
			<div>
				<div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
					<Radio size={14} className="text-orange-500" /> Delivery events
				</div>
				<h1 className="text-2xl font-semibold">Webhooks</h1>
				<p className="mt-1 text-xs text-muted-foreground">
					EmailFlare signs each request with HMAC-SHA256 in X-EmailFlare-Signature.
				</p>
			</div>
			<form
				className="space-y-3 rounded-xl border p-4"
				onSubmit={async (e) => {
					e.preventDefault();
					const { data } = await api.post<{ secret: string }>("/api/webhooks", { url, events });
					setSecret(data.secret);
					setUrl("");
					await load();
				}}
			>
				<Input
					value={url}
					onChange={(e) => setUrl(e.target.value)}
					placeholder="https://example.com/hooks/email"
					required
				/>
				<div className="flex flex-wrap gap-3">
					{EVENTS.map((event) => (
						<label key={event} className="flex items-center gap-1.5 text-xs">
							<input
								type="checkbox"
								checked={events.includes(event)}
								onChange={(e) =>
									setEvents((current) =>
										e.target.checked
											? [...current, event]
											: current.filter((item) => item !== event),
									)
								}
							/>
							{event}
						</label>
					))}
				</div>
				<Button type="submit" size="sm" disabled={events.length === 0}>
					Add webhook
				</Button>
			</form>
			{secret && (
				<p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 font-mono text-xs text-orange-950">
					Signing secret, shown once: {secret}
				</p>
			)}
			<ul className="divide-y rounded-xl border">
				{hooks.map((hook) => (
					<li key={hook.id} className="flex items-center justify-between gap-3 px-4 py-3">
						<div>
							<p className="font-mono text-xs">{hook.url}</p>
							<p className="text-[11px] text-muted-foreground">{hook.events}</p>
						</div>
						<Button
							size="sm"
							variant="ghost"
							onClick={async () => {
								await api.delete(`/api/webhooks/${hook.id}`);
								await load();
							}}
						>
							Disable
						</Button>
					</li>
				))}
				{hooks.length === 0 && (
					<li className="px-4 py-8 text-center text-xs text-muted-foreground">No webhooks yet.</li>
				)}
			</ul>
		</div>
	);
}
