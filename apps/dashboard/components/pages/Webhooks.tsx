"use client";

import { useEffect, useState } from "react";
import { KeyRound, Radio } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageHeader, PageShell } from "@/components/app/PageHeader";

const EVENTS = [
	"email.sent",
	"email.failed",
	"email.opened",
	"email.clicked",
	"email.bounced",
	"domain.degraded",
	"domain.recovered",
];

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
		<PageShell width="narrow">
			<PageHeader
				eyebrow="Delivery events"
				title="Webhooks"
				description="EmailFlare signs each request with HMAC-SHA256 in X-EmailFlare-Signature."
			/>
			<Card>
				<CardContent>
					<form
						className="space-y-3"
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
						<div className="flex flex-wrap gap-x-4 gap-y-2">
							{EVENTS.map((event) => (
								<Label key={event} className="gap-1.5 text-xs">
									<Checkbox
										checked={events.includes(event)}
										onCheckedChange={(checked) =>
											setEvents((current) =>
												checked
													? [...current, event]
													: current.filter((item) => item !== event),
											)
										}
									/>
									{event}
								</Label>
							))}
						</div>
						<Button type="submit" size="sm" disabled={events.length === 0}>
							Add webhook
						</Button>
					</form>
				</CardContent>
			</Card>
			{secret && (
				<Alert variant="warning">
					<KeyRound />
					<AlertTitle>Signing secret, shown once</AlertTitle>
					<AlertDescription className="font-mono text-xs break-all text-current select-all">
						{secret}
					</AlertDescription>
				</Alert>
			)}
			<Card className="gap-0 py-0">
				{hooks.length === 0 ? (
					<Empty className="py-12">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<Radio />
							</EmptyMedia>
							<EmptyTitle>No webhooks yet.</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="divide-y divide-border">
						{hooks.map((hook) => (
							<li key={hook.id} className="flex items-center justify-between gap-3 px-4 py-3">
								<div className="min-w-0">
									<p className="font-mono text-xs break-all">{hook.url}</p>
									<p className="text-2xs text-muted-foreground">{hook.events}</p>
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
					</ul>
				)}
			</Card>
		</PageShell>
	);
}
