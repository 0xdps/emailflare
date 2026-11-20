"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

/** Label + control with consistent spacing. */
export function FormField({
	label,
	htmlFor,
	children,
}: {
	label: string;
	htmlFor?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={htmlFor}>{label}</Label>
			{children}
		</div>
	);
}

type PasswordFieldProps = Omit<React.ComponentProps<"input">, "type"> & {
	label: string;
	/** Controlled visibility, so "confirm" fields can follow the main one. */
	visible?: boolean;
	onVisibleChange?: (visible: boolean) => void;
};

export function PasswordField({ label, id, visible, onVisibleChange, ...props }: PasswordFieldProps) {
	const [internal, setInternal] = useState(false);
	const show = visible ?? internal;
	const toggle = () => (onVisibleChange ?? setInternal)(!show);

	return (
		<FormField label={label} htmlFor={id}>
			<InputGroup>
				<InputGroupInput id={id} type={show ? "text" : "password"} {...props} />
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						size="icon-xs"
						tabIndex={-1}
						aria-label={show ? "Hide password" : "Show password"}
						onClick={toggle}
					>
						{show ? <EyeOff /> : <Eye />}
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</FormField>
	);
}

export function TextField({ label, id, ...props }: React.ComponentProps<"input"> & { label: string }) {
	return (
		<FormField label={label} htmlFor={id}>
			<Input id={id} {...props} />
		</FormField>
	);
}

export function FormError({ children }: { children?: React.ReactNode }) {
	if (!children) return null;
	return (
		<Alert variant="destructive">
			<AlertDescription>{children}</AlertDescription>
		</Alert>
	);
}

export function SubmitButton({
	loading,
	loadingLabel,
	children,
	...props
}: React.ComponentProps<typeof Button> & { loading: boolean; loadingLabel: string }) {
	return (
		<Button type="submit" size="lg" className="mt-1 w-full" {...props} disabled={props.disabled || loading}>
			{loading && <Spinner data-icon="inline-start" />}
			{loading ? loadingLabel : children}
		</Button>
	);
}
