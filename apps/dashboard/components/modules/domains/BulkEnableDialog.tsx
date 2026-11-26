"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, Minus, X } from "lucide-react";
import { previewDomainAction, runDomainStepAction } from "@/app/actions/domains";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { DOMAIN_STEPS, type DomainStep, type StepResult } from "@/lib/core/domain-plan";
import { defaultSendingName } from "./copy";

type RowState = "queued" | "working" | "done" | "attention" | "failed" | "skipped";

interface Row {
	state: RowState;
	note: string;
}

const ICON: Record<RowState, React.ReactNode> = {
	queued: <span className="size-2 rounded-full bg-muted-foreground/30" />,
	working: <Spinner className="size-4" />,
	done: <Check className="size-4 text-success" />,
	attention: <AlertTriangle className="size-4 text-warning" />,
	failed: <X className="size-4 text-destructive" />,
	skipped: <Minus className="size-4 text-muted-foreground" />,
};

const WORKING_NOTE: Record<DomainStep, string> = {
	sending: "Creating sending domain…",
	dns: "Publishing DNS…",
	routing: "Routing mail…",
	save: "Saving…",
};

/** Sets up several zones one after another with the safe defaults, and reports each on its own line. */
export default function BulkEnableDialog({
	zones,
	onClose,
	onFinished,
}: {
	zones: string[] | null;
	onClose: () => void;
	onFinished: () => void;
}) {
	const [rows, setRows] = useState<Record<string, Row>>({});
	const [running, setRunning] = useState(false);
	const [started, setStarted] = useState(false);
	const saved = useRef(false);

	// Keep the last list while the dialog animates closed, so it does not flash empty.
	const lastZones = useRef<string[]>([]);
	if (zones) lastZones.current = zones;
	const list = zones ?? lastZones.current;

	function setRow(zone: string, row: Row) {
		setRows((prev) => ({ ...prev, [zone]: row }));
	}

	async function setUpZone(zone: string) {
		const name = defaultSendingName(zone);
		setRow(zone, { state: "working", note: "Reading the zone…" });

		const preview = await previewDomainAction({ name, zoneName: zone }).catch((err: unknown) => ({
			ok: false as const,
			error: err instanceof Error ? err.message : "Could not read the zone",
		}));
		if (!preview.ok) return setRow(zone, { state: "failed", note: preview.error });
		if (preview.plan.blocked) return setRow(zone, { state: "skipped", note: preview.plan.blocked });

		// Receiving only where it cannot take mail from another provider or an existing catch-all.
		const receiving = preview.plan.receivingDefault;
		const results: Partial<Record<DomainStep, StepResult>> = {};
		let dnsStatus: "written" | "manual" | undefined;

		for (const step of DOMAIN_STEPS) {
			setRow(zone, { state: "working", note: WORKING_NOTE[step] });
			const result: StepResult = await runDomainStepAction({
				name,
				zoneName: zone,
				step,
				receiving,
				dnsStatus,
			}).catch((err: unknown) => ({
				step,
				status: "failed" as const,
				message: err instanceof Error ? err.message : "Something went wrong",
			}));
			results[step] = result;
			if (result.dnsStatus) dnsStatus = result.dnsStatus;
			if (result.status === "failed" && step !== "routing") {
				return setRow(zone, { state: "failed", note: `${result.message} Retry to continue from here.` });
			}
		}

		if (results.save?.status === "done") saved.current = true;
		if (results.dns?.status === "warning") {
			return setRow(zone, {
				state: "attention",
				note: "Saved, but some DNS records must be added by hand. Open the domain to copy them.",
			});
		}
		if (results.routing?.status === "failed") {
			return setRow(zone, {
				state: "attention",
				note: "Saved and can send, but receiving could not be turned on. Open the domain to retry.",
			});
		}
		if (!receiving) {
			return setRow(zone, {
				state: "attention",
				note: "Saved for sending only. Receiving was left off because mail for this zone is handled elsewhere; turn it on from the domain page if you want it.",
			});
		}
		setRow(zone, { state: "done", note: `Sends from ${name} and receives mail.` });
	}

	async function run(only?: string[]) {
		setStarted(true);
		setRunning(true);
		const targets = only ?? list;
		setRows((prev) => ({
			...prev,
			...Object.fromEntries(targets.map((z) => [z, { state: "queued" as const, note: "Waiting" }])),
		}));
		for (const zone of targets) await setUpZone(zone);
		setRunning(false);
		if (saved.current) onFinished();
	}

	function close() {
		setRows({});
		setStarted(false);
		saved.current = false;
		onClose();
	}

	const failed = list.filter((z) => rows[z]?.state === "failed");

	return (
		<Dialog open={!!zones} onOpenChange={(next) => !next && !running && close()}>
			<DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>
						Set up {list.length} {list.length === 1 ? "domain" : "domains"}
					</DialogTitle>
					<DialogDescription>
						Each domain sends from <span className="font-mono">mail.&lt;domain&gt;</span>. Receiving is
						turned on only where it cannot take mail from another provider or replace an existing catch-all;
						those domains are set up for sending only, and you can turn receiving on later.
					</DialogDescription>
				</DialogHeader>

				<ul className="space-y-2">
					{list.map((zone) => {
						const row = rows[zone];
						return (
							<li key={zone} className="flex items-start gap-3 rounded-lg border p-3">
								<div className="mt-0.5 grid size-5 place-items-center">
									{ICON[row?.state ?? "queued"]}
								</div>
								<div className="min-w-0 flex-1">
									<p className="font-mono text-sm">{zone}</p>
									<p className="text-2xs text-muted-foreground">
										{row?.note ?? `Will send from ${defaultSendingName(zone)}`}
									</p>
								</div>
							</li>
						);
					})}
				</ul>

				<DialogFooter>
					{!started ? (
						<>
							<Button variant="ghost" onClick={close}>
								Cancel
							</Button>
							<Button onClick={() => void run()}>Set up {list.length}</Button>
						</>
					) : (
						<>
							{failed.length > 0 && !running && (
								<Button variant="outline" onClick={() => void run(failed)}>
									Retry {failed.length} failed
								</Button>
							)}
							<Button disabled={running} onClick={close}>
								{running ? "Working…" : "Done"}
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
