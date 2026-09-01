import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text, Tailwind } from "@react-email/components";
import { getThemeConfig } from "../ThemeContext.js";

interface EmailChangeConfirmedProps {
	name?: string;
	appName?: string;
	oldEmail?: string;
	newEmail?: string;
	changedAt?: string;
	supportUrl?: string;
}

export const EmailChangeConfirmed: React.FC<EmailChangeConfirmedProps> = ({
	name = "there",
	appName = "our app",
	oldEmail = "old@example.com",
	newEmail = "new@example.com",
	changedAt = "just now",
	supportUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your email was updated</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Email updated</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your email on {appName} was changed at {changedAt}.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>Old:</strong> {oldEmail}
						<br />
						<strong>New:</strong> {newEmail}
					</Text>
					<Text className="text-email-muted text-sm">
						If this was not you, secure your account immediately: {supportUrl}
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default EmailChangeConfirmed;
