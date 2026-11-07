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

interface PasswordResetProps {
	name?: string;
	appName?: string;
	resetUrl?: string;
	expiresIn?: string;
}

export const PasswordReset: React.FC<PasswordResetProps> = ({
	name = "there",
	appName = "our app",
	resetUrl = "#",
	expiresIn = "30 minutes",
}) => (
	<Html>
		<Head />
		<Preview>Reset your {appName} password</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Reset your password</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, we received a request to reset the password for your {appName} account. Click the
						button below to choose a new password. This link expires in <strong>{expiresIn}</strong>.
					</Text>
					<Section className="my-8">
						<Button
							href={resetUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Reset password →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						If you didn't request a password reset, please ignore this email — your password will remain
						unchanged. For security concerns, contact our support team.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default PasswordReset;
