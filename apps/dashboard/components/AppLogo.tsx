"use client";

import { useId } from "react";

export default function AppLogo({ size = 26 }: { size?: number }) {
	const id = useId().replace(/:/g, "");
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
			<defs>
				<linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
					<stop offset="0%" stopColor="#9a3412" />
					<stop offset="58%" stopColor="#ea580c" />
					<stop offset="100%" stopColor="#fb923c" />
				</linearGradient>
			</defs>
			<rect width="64" height="64" rx="13" fill={`url(#${id})`} />
			<path d="M53 11 L9 28 L23 38 Z" fill="white" />
			<path d="M53 11 L23 38 L9 53 Z" fill="white" opacity="0.82" />
		</svg>
	);
}
