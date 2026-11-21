import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
	text: string;
	label?: string;
	className?: string;
}

export default function CopyButton({ text, label = "Copy", className }: Props) {
	const [copied, setCopied] = useState(false);

	async function copy() {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 1600);
	}

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			onClick={copy}
			aria-label={copied ? "Copied" : label}
			className={cn("text-ink-muted hover:bg-ink-border hover:text-ink-foreground", className)}
		>
			{copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
		</Button>
	);
}
