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

interface PlainProps {
	name?: string;
	subject?: string;
	body?: string;
	ctaUrl?: string;
	ctaLabel?: string;
	appName?: string;
	footerNote?: string;
}

export const Plain: React.FC<PlainProps> = ({
	name = "there",
	subject = "A message for you",
	body = "This is a plain email message.",
	ctaUrl = "",
	ctaLabel = "Learn more",
	appName = "our app",
	footerNote = "",
}) => (
	<Html>
		<Head />
		<Preview>{subject}</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">{subject}</Heading>
					{name && name !== "there" && (
						<Text className="text-email-body text-base leading-relaxed">Hi {name},</Text>
					)}
					<Text className="text-email-body text-base leading-relaxed whitespace-pre-line">{body}</Text>
					{ctaUrl && (
						<Section className="my-8">
							<Button
								href={ctaUrl}
								className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
							>
								{ctaLabel} →
							</Button>
						</Section>
					)}
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						{footerNote || `This email was sent by ${appName}.`}
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default Plain;
