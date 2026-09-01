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

interface PasswordChangedProps {
	name?: string;
	appName?: string;
	changedAt?: string;
	supportUrl?: string;
}

export const PasswordChanged: React.FC<PasswordChangedProps> = ({
	name = "there",
	appName = "our app",
	changedAt = "just now",
	supportUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your {appName} password has been changed</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Section className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 mb-6">
						<Text className="text-amber-800 text-sm font-medium m-0">🔐 Security notice</Text>
					</Section>
					<Heading className="text-2xl font-bold text-email-heading mt-0">Your password was changed</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, the password for your {appName} account was successfully changed on{" "}
						<strong>{changedAt}</strong>.
					</Text>
					<Text className="text-email-body text-base leading-relaxed">
						If you made this change, no action is needed. If you did not change your password, please secure
						your account immediately.
					</Text>
					<Section className="my-8">
						<Button
							href={supportUrl}
							className="bg-red-500 text-white font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Secure my account →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						This is an automated security notification from {appName}. If you need help, contact our support
						team.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default PasswordChanged;
