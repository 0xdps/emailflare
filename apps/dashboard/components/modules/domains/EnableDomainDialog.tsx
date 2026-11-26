"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Copy, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { previewDomainAction, runDomainStepAction } from "@/app/actions/domains";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
	DOMAIN_STEPS,
	STEP_LABEL,
	buildPlan,
	type DomainFacts,
	type DomainStep,
	type PlanAction,
	type StepResult,
} from "@/lib/core/domain-plan";
import { ENABLE_EXPLAINER, SENDING_NAME_HELP } from "./copy";

export interface EnableTarget {
	zoneName: string;
	sendingName: string;
}

const ACTION_BADGE: Record<PlanAction, { label: string; variant: "soft" | "outline" | "warning" | "info" }> = {
	add: { label: "Add", variant: "soft" },
	keep: { label: "Keep", variant: "outline" },
	replace: { label: "Replace", variant: "warning" },
	skip: { label: "Skip", variant: "outline" },
	info: { label: "Note", variant: "info" },
};

function copy(text: string, label: string) {
	navigator.clipboard.writeText(text).then(
		() => toast.success(`${label} copied`),
		() => toast.error("Could not copy to clipboard"),
	);
}

function StepIcon({ status, running }: { status: StepResult["status"] | undefined; running: boolean }) {
	if (running) return <Spinner className="size-4" />;
	if (status === "done") return <Check className="size-4 text-success" />;
	if (status === "warning") return <AlertTriangle className="size-4 text-warning" />;
	if (status === "failed") return <X className="size-4 text-destructive" />;
	if (status === "skipped") return <Minus className="size-4 text-muted-foreground" />;
	return <span className="size-2 rounded-full bg-muted-foreground/30" />;
}

/**
 * The one way to enable a domain, used from the Domains page and first-run setup.
 * Review what is in the zone and what will change, then watch each stage run for real.
 */
export default function EnableDomainDialog({
	target,
	onClose,
	onFinished,
}: {
	target: EnableTarget | null;
	onClose: () => void;
	onFinished: () => void;
}) {
	const [name, setName] = useState("");
	const [checkedName, setCheckedName] = useState("");
	const [facts, setFacts] = useState<DomainFacts | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [receiving, setReceiving] = useState(true);
	const [phase, setPhase] = useState<"review" | "running" | "done">("review");
	const [results, setResults] = useState<Partial<Record<DomainStep, StepResult>>>({});
	const [running, setRunning] = useState<DomainStep | null>(null);
	const finished = useRef(false);
	// Keep the last target while the dialog animates closed, so the title does not go blank.
	const lastTarget = useRef<EnableTarget | null>(null);
	if (target) lastTarget.current = target;
	const shownZone = (target ?? lastTarget.current)?.zoneName;

	// Reset whenever the dialog opens for a (new) target.
	useEffect(() => {
		if (!target) return;
		setName(target.sendingName);
		setCheckedName(target.sendingName);
		setFacts(null);
		setLoadError(null);
		setPhase("review");
		setResults({});
		setRunning(null);
		finished.current = false;
	}, [target]);

	// Read-only look at the zone for the current name.
	useEffect(() => {
		if (!target || !checkedName) return;
		let cancelled = false;
		setFacts(null);
		setLoadError(null);
		previewDomainAction({ name: checkedName, zoneName: target.zoneName })
			.then((res) => {
				if (cancelled) return;
				if (!res.ok) return setLoadError(res.error);
				setFacts(res.facts);
				setReceiving(res.plan.receivingDefault);
			})
			.catch((err: unknown) => {
				if (!cancelled)
					setLoadError(err instanceof Error ? err.message : "Could not read the zone from Cloudflare.");
			});
		return () => {
			cancelled = true;
		};
	}, [target, checkedName]);

	const plan = facts ? buildPlan(facts, { receiving }) : null;

	async function run(from: DomainStep) {
		if (!target) return;
		setPhase("running");
		let dnsStatus = results.dns?.dnsStatus;
		const next = { ...results };
		for (const step of DOMAIN_STEPS.slice(DOMAIN_STEPS.indexOf(from))) {
			setRunning(step);
			let result: StepResult;
			try {
				result = await runDomainStepAction({
					name: checkedName,
					zoneName: target.zoneName,
					step,
					receiving,
					dnsStatus,
				});
			} catch (err: unknown) {
				result = {
					step,
					status: "failed",
					message: err instanceof Error ? err.message : "Something went wrong.",
				};
			}
			next[step] = result;
			setResults({ ...next });
			if (result.dnsStatus) dnsStatus = result.dnsStatus;
			// A routing problem should not stop the domain from being saved; the reader can retry it.
			if (result.status === "failed" && step !== "routing") {
				setRunning(null);
				return;
			}
		}
		setRunning(null);
		// Once the domain is saved the list is out of date, even if receiving still needs a retry.
		if (next.save?.status === "done" && !finished.current) {
			finished.current = true;
			onFinished();
		}
		if (next.routing?.status !== "failed") setPhase("done");
	}

	const failedStep = DOMAIN_STEPS.find((s) => results[s]?.status === "failed");
	const manualRecords = results.dns?.records ?? [];
	const nameChanged = name.trim() !== checkedName;

	return (
		<Dialog open={!!target} onOpenChange={(open) => !open && running === null && onClose()}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>
						{phase === "review" ? "Enable" : phase === "running" ? "Setting up" : "Done:"} {shownZone}
					</DialogTitle>
					<DialogDescription>
						{phase === "review"
							? ENABLE_EXPLAINER
							: phase === "running"
								? "Each step runs against Cloudflare. If one fails you can retry just that step."
								: "The domain is set up. Sending is confirmed by Cloudflare once DNS propagates."}
					</DialogDescription>
				</DialogHeader>

				{phase === "review" && (
					<div className="space-y-4">
						<form
							className="space-y-1.5"
							onSubmit={(e) => {
								e.preventDefault();
								setCheckedName(name.trim());
							}}
						>
							<Label htmlFor="enable-sending-name">Send from</Label>
							<div className="flex gap-2">
								<Input
									id="enable-sending-name"
									value={name}
									onChange={(e) => setName(e.target.value.toLowerCase().trim())}
									onBlur={() => name.trim() && setCheckedName(name.trim())}
									className="font-mono text-xs"
								/>
								{nameChanged && (
									<Button type="submit" variant="outline">
										Check
									</Button>
								)}
							</div>
							<p className="text-2xs text-muted-foreground">{SENDING_NAME_HELP}</p>
						</form>

						{loadError ? (
							<Alert variant="destructive">
								<AlertDescription>{loadError}</AlertDescription>
							</Alert>
						) : !plan || !facts ? (
							<div className="space-y-2" aria-busy="true" aria-label="Reading the zone from Cloudflare">
								<Skeleton className="h-4 w-48" />
								<Skeleton className="h-14 rounded-lg" />
								<Skeleton className="h-14 rounded-lg" />
								<Skeleton className="h-14 rounded-lg" />
							</div>
						) : (
							<>
								<div className="flex items-start gap-2.5 rounded-lg border p-3">
									<Checkbox
										id="enable-receiving"
										checked={receiving}
										onCheckedChange={(checked) => setReceiving(checked === true)}
										className="mt-0.5"
									/>
									<div className="space-y-0.5">
										<Label htmlFor="enable-receiving" className="text-sm">
											Receive mail on {facts.zoneName}
										</Label>
										<p className="text-2xs text-muted-foreground">
											Routes the zone&apos;s catch-all to this inbox. Leave it off to only send,
											and nothing about receiving changes.
										</p>
									</div>
								</div>

								<p className="text-xs font-medium text-muted-foreground">What will happen</p>
								<ul className="space-y-2">
									{plan.items.map((item) => {
										const badge = ACTION_BADGE[item.action];
										return (
											<li
												key={item.id}
												className="flex items-start gap-2.5 rounded-lg border p-3"
											>
												<Badge variant={badge.variant} className="mt-0.5 w-16">
													{badge.label}
												</Badge>
												<div className="min-w-0 space-y-0.5">
													<p className="text-sm font-medium">{item.title}</p>
													<p className="text-2xs text-muted-foreground">{item.detail}</p>
												</div>
											</li>
										);
									})}
								</ul>

								{plan.warnings.map((warning) => (
									<Alert key={warning} variant="warning">
										<AlertTriangle />
										<AlertDescription>{warning}</AlertDescription>
									</Alert>
								))}
								{plan.blocked && (
									<Alert variant="destructive">
										<AlertDescription>{plan.blocked}</AlertDescription>
									</Alert>
								)}
							</>
						)}

						<DialogFooter>
							<Button type="button" variant="ghost" onClick={onClose}>
								Cancel
							</Button>
							<Button
								type="button"
								disabled={!plan || !!plan.blocked || nameChanged}
								onClick={() => void run("sending")}
							>
								Enable
							</Button>
						</DialogFooter>
					</div>
				)}

				{phase !== "review" && (
					<div className="space-y-4">
						<ol className="space-y-2">
							{DOMAIN_STEPS.map((step) => {
								const result = results[step];
								const isRunning = running === step;
								return (
									<li key={step} className="flex items-start gap-3 rounded-lg border p-3">
										<div className="mt-0.5 grid size-5 place-items-center">
											<StepIcon status={result?.status} running={isRunning} />
										</div>
										<div className="min-w-0 flex-1 space-y-0.5">
											<p className="text-sm font-medium">{STEP_LABEL[step]}</p>
											<p className="text-2xs text-muted-foreground">
												{isRunning ? "Working…" : (result?.message ?? "Waiting")}
											</p>
										</div>
										{result?.status === "failed" && running === null && (
											<Button size="sm" variant="outline" onClick={() => void run(step)}>
												Retry
											</Button>
										)}
									</li>
								);
							})}
						</ol>

						{manualRecords.length > 0 && (
							<div className="space-y-2">
								<p className="text-xs font-medium">Add these records in Cloudflare DNS</p>
								{manualRecords.map((record, index) => (
									<div key={index} className="space-y-1.5 rounded-lg border bg-muted/20 p-3 text-xs">
										<div className="flex items-center justify-between">
											<Badge variant="soft" className="font-mono">
												{record.type}
											</Badge>
											<div className="flex gap-1">
												<Button
													size="xs"
													variant="ghost"
													onClick={() => copy(record.name, "Name")}
												>
													<Copy /> Name
												</Button>
												<Button
													size="xs"
													variant="ghost"
													onClick={() => copy(record.content, "Value")}
												>
													<Copy /> Value
												</Button>
											</div>
										</div>
										<p className="font-mono break-all">{record.name}</p>
										<p className="font-mono break-all text-muted-foreground">{record.content}</p>
									</div>
								))}
							</div>
						)}

						{results.routing?.status === "failed" && (
							<Alert variant="warning">
								<AlertDescription>
									The domain is saved and can send. Receiving could not be turned on; retry it above,
									or use Re-check on the Domains page later.
								</AlertDescription>
							</Alert>
						)}

						<DialogFooter>
							{failedStep && running === null ? (
								<Button variant="ghost" onClick={onClose}>
									Close
								</Button>
							) : (
								<Button disabled={running !== null} onClick={onClose}>
									Done
								</Button>
							)}
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
