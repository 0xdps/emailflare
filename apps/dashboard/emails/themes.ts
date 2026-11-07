export interface EmailTheme {
	primary: string; // brand accent — buttons, links, OTP highlight
	primaryFg: string; // text on primary bg
	primarySubtle: string; // light tint bg for badges/code blocks
	secondary: string; // secondary button bg
	bodyBg: string; // outermost page background
	surface: string; // card / container background
	heading: string; // h1/h2 color
	strong: string; // inline data, secondary headings
	body: string; // main paragraph text
	muted: string; // footer / hint text
	border: string; // Hr / divider lines
}

export const THEMES: Record<string, EmailTheme> = {
	default: {
		primary: "#f97316", // orange-500
		primaryFg: "#ffffff",
		primarySubtle: "#fff7ed", // orange-50
		secondary: "#1e293b", // slate-800
		bodyBg: "#f8fafc", // slate-50
		surface: "#ffffff",
		heading: "#0f172a", // slate-900
		strong: "#334155", // slate-700
		body: "#475569", // slate-600
		muted: "#94a3b8", // slate-400
		border: "#e2e8f0", // slate-200
	},
	ocean: {
		primary: "#0ea5e9", // sky-500
		primaryFg: "#ffffff",
		primarySubtle: "#f0f9ff", // sky-50
		secondary: "#0c4a6e", // sky-950
		bodyBg: "#f0f9ff",
		surface: "#ffffff",
		heading: "#0c4a6e",
		strong: "#075985",
		body: "#0369a1",
		muted: "#7dd3fc",
		border: "#bae6fd",
	},
	forest: {
		primary: "#16a34a", // green-600
		primaryFg: "#ffffff",
		primarySubtle: "#f0fdf4", // green-50
		secondary: "#14532d", // green-950
		bodyBg: "#f0fdf4",
		surface: "#ffffff",
		heading: "#14532d",
		strong: "#166534",
		body: "#15803d",
		muted: "#86efac",
		border: "#bbf7d0",
	},
	violet: {
		primary: "#7c3aed", // violet-600
		primaryFg: "#ffffff",
		primarySubtle: "#f5f3ff", // violet-50
		secondary: "#4c1d95", // violet-950
		bodyBg: "#f5f3ff",
		surface: "#ffffff",
		heading: "#2e1065",
		strong: "#3b0764",
		body: "#6d28d9",
		muted: "#c4b5fd",
		border: "#ddd6fe",
	},
	slate: {
		primary: "#334155", // slate-700 (monochrome)
		primaryFg: "#ffffff",
		primarySubtle: "#f1f5f9", // slate-100
		secondary: "#0f172a", // slate-900
		bodyBg: "#f8fafc",
		surface: "#ffffff",
		heading: "#0f172a",
		strong: "#1e293b",
		body: "#475569",
		muted: "#94a3b8",
		border: "#e2e8f0",
	},
};

export function themeToTailwindConfig(theme: EmailTheme) {
	return {
		theme: {
			extend: {
				colors: {
					"email-bg": theme.bodyBg,
					"email-surface": theme.surface,
					"email-heading": theme.heading,
					"email-strong": theme.strong,
					"email-body": theme.body,
					"email-muted": theme.muted,
					"email-border": theme.border,
					"email-primary": theme.primary,
					"email-primary-fg": theme.primaryFg,
					"email-primary-subtle": theme.primarySubtle,
					"email-secondary": theme.secondary,
				},
			},
		},
	};
}
