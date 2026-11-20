"use client";

import React from "react";
import AppLogo from "@/components/AppLogo";

interface AuthLayoutProps {
	eyebrow: string;
	headline: string;
	highlight: string;
	description: string;
	features?: string[];
	children: React.ReactNode;
}

/**
 * Split-screen frame for sign-in style pages. The brand panel is scoped to the
 * `dark` theme so it stays dark in light mode while still using theme tokens.
 */
export function AuthLayout({ eyebrow, headline, highlight, description, features, children }: AuthLayoutProps) {
	return (
		<div className="flex min-h-svh bg-background">
			<aside className="dark relative hidden w-[440px] shrink-0 flex-col justify-between overflow-hidden bg-background px-10 py-12 text-foreground lg:flex">
				<div
					aria-hidden
					className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-primary/20 blur-3xl"
				/>
				<div className="relative flex items-center gap-2.5">
					<AppLogo size={28} />
					<span className="text-sm font-semibold tracking-tight">EmailFlare</span>
				</div>

				<div className="relative">
					<p className="mb-4 text-2xs font-semibold tracking-widest text-primary uppercase">{eyebrow}</p>
					<h1 className="mb-4 text-3xl leading-tight font-bold">
						{headline}
						<br />
						<span className="text-primary">{highlight}</span>
					</h1>
					<p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
					{features && (
						<ul className="mt-8 flex flex-col gap-3">
							{features.map((feature) => (
								<li key={feature} className="flex items-center gap-2.5 text-sm text-muted-foreground">
									<span className="size-1 shrink-0 rounded-full bg-primary" />
									{feature}
								</li>
							))}
						</ul>
					)}
				</div>

				<p className="relative text-2xs text-muted-foreground/70">Powered by Cloudflare Workers &amp; D1</p>
			</aside>

			<main className="flex flex-1 items-center justify-center px-6 py-10">
				<div className="w-full max-w-sm">
					<div className="mb-8 flex items-center gap-2 lg:hidden">
						<AppLogo size={26} />
						<span className="text-sm font-semibold">EmailFlare</span>
					</div>
					{children}
				</div>
			</main>
		</div>
	);
}

/** Single centred column for short flows (reset password, accept invite). */
export function AuthCentered({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
	return (
		<main className="flex min-h-svh items-center justify-center bg-background px-6 py-10">
			<div className={wide ? "w-full max-w-md" : "w-full max-w-sm"}>
				<div className="mb-8 flex items-center gap-2.5">
					<AppLogo size={28} />
					<span className="text-sm font-semibold tracking-tight">EmailFlare</span>
				</div>
				{children}
			</div>
		</main>
	);
}

export function AuthHeading({ title, description }: { title: string; description?: React.ReactNode }) {
	return (
		<div className="mb-7">
			<h2 className="text-xl font-semibold tracking-tight">{title}</h2>
			{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
		</div>
	);
}
