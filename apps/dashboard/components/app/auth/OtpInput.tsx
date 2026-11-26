"use client";

import React, { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

type OtpInputProps = {
	value: string;
	onChange: (value: string) => void;
	/** Called once with the full code as soon as the last digit is entered. */
	onComplete?: (value: string) => void;
	length?: number;
	disabled?: boolean;
	invalid?: boolean;
	autoFocus?: boolean;
	label?: string;
};

/** One box per digit. Typing, pasting and one-time-code autofill all flow forward. */
export function OtpInput({
	value,
	onChange,
	onComplete,
	length = 6,
	disabled,
	invalid,
	autoFocus,
	label = "Authenticator code",
}: OtpInputProps) {
	const refs = useRef<(HTMLInputElement | null)[]>([]);
	const digits = Array.from({ length }, (_, i) => value[i] ?? "");

	function focusAt(index: number) {
		const box = refs.current[Math.max(0, Math.min(length - 1, index))];
		box?.focus();
		box?.select();
	}

	// Parent clears the value after a failed attempt; start over from the first box.
	useEffect(() => {
		if (value === "" && !disabled) focusAt(0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value === "", disabled]);

	function commit(next: string, focusIndex: number) {
		onChange(next);
		if (next.length === length) {
			refs.current[length - 1]?.blur();
			onComplete?.(next);
		} else {
			focusAt(focusIndex);
		}
	}

	// Replace digits starting at `index` with the typed/pasted ones.
	function insert(index: number, raw: string) {
		const incoming = raw.replace(/\D/g, "");
		if (!incoming) return;
		const next = (value.slice(0, index) + incoming + value.slice(index + incoming.length)).slice(0, length);
		commit(next, Math.min(index + incoming.length, length - 1));
	}

	function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Backspace") {
			e.preventDefault();
			if (digits[index]) {
				onChange(value.slice(0, index) + value.slice(index + 1));
			} else if (index > 0) {
				onChange(value.slice(0, index - 1) + value.slice(index));
				focusAt(index - 1);
			}
		} else if (e.key === "ArrowLeft") {
			e.preventDefault();
			focusAt(index - 1);
		} else if (e.key === "ArrowRight") {
			e.preventDefault();
			focusAt(index + 1);
		}
	}

	return (
		<div role="group" aria-label={label} className="flex items-center justify-between gap-2">
			{digits.map((digit, i) => (
				<Input
					key={i}
					ref={(el: HTMLInputElement | null) => {
						refs.current[i] = el;
					}}
					value={digit}
					onChange={(e) => insert(i, e.target.value)}
					onKeyDown={(e) => handleKeyDown(i, e)}
					onPaste={(e) => {
						e.preventDefault();
						insert(i, e.clipboardData.getData("text"));
					}}
					onFocus={(e) => e.target.select()}
					inputMode="numeric"
					pattern="[0-9]*"
					autoComplete={i === 0 ? "one-time-code" : "off"}
					autoFocus={autoFocus && i === 0}
					disabled={disabled}
					aria-invalid={invalid || undefined}
					aria-label={`${label}, digit ${i + 1} of ${length}`}
					className="h-11 flex-1 px-0 text-center font-mono text-lg"
				/>
			))}
		</div>
	);
}
