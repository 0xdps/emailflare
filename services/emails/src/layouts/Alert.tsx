import * as React from "react";
import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Preview,
	Section,
	Text,
	Tailwind,
	Hr,
} from "@react-email/components";
import { getThemeConfig } from "../ThemeContext.js";

interface AlertProps {
	name?: string;
	appName?: string;
	title?: string;
	message?: string;
	severity?: string;
	actionUrl?: string;
	actionLabel?: string;
}

function severityStyles(severity: string): { bg: string; border: string; text: string; emoji: string } {
	switch (severity.toLowerCase()) {
		case "critical":
		case "error":
			return { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", emoji: "🚨" };
		case "warning":
			return { bg: "#fffbeb", border: "#fde68a", text: "#92400e", emoji: "⚠️" };
		case "success":
			return { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", emoji: "✅" };
		default: // info
			return { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", emoji: "ℹ️" };
	}
}

export const Alert: React.FC<AlertProps> = ({
	name = "there",
	appName = "our app",
	title = "System alert",
	message = "Something requires your attention.",
	severity = "info",
	actionUrl = "",
	actionLabel = "View details",
}) => {
	const s = severityStyles(severity);
	return (
		<Html>
			<Head />
			<Preview>
				[{severity.toUpperCase()}] {title}
			</Preview>
			<Tailwind config={getThemeConfig() as any}>
				<Body className="bg-email-bg font-sans py-8">
					<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
						<Section
							style={{
								background: s.bg,
								border: `1px solid ${s.border}`,
								borderRadius: "8px",
								padding: "12px 20px",
								marginBottom: "24px",
							}}
						>
							<Text style={{ color: s.text, fontSize: "13px", fontWeight: "600", margin: 0 }}>
								{s.emoji} {severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase()}
							</Text>
						</Section>
						<Heading className="text-2xl font-bold text-email-heading mt-0">{title}</Heading>
						<Text className="text-email-body text-base leading-relaxed">Hi {name},</Text>
						<Text className="text-email-body text-base leading-relaxed">{message}</Text>
						{actionUrl && (
							<Section className="my-8">
								<Button
									href={actionUrl}
									className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
								>
									{actionLabel} →
								</Button>
							</Section>
						)}
						<Hr className="border-email-border my-6" />
						<Text className="text-email-muted text-sm">
							This alert was sent by {appName}. If you believe this was sent in error, please contact
							support.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default Alert;
