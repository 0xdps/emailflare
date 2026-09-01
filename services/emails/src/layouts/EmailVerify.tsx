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

interface EmailVerifyProps {
	name?: string;
	appName?: string;
	verifyUrl?: string;
	expiresIn?: string;
}

export const EmailVerify: React.FC<EmailVerifyProps> = ({
	name = "there",
	appName = "our app",
	verifyUrl = "#",
	expiresIn = "24 hours",
}) => (
	<Html>
		<Head />
		<Preview>Verify your email address for {appName}</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Confirm your email address</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, thanks for signing up for {appName}. Please verify your email address by clicking the
						button below. This link expires in <strong>{expiresIn}</strong>.
					</Text>
					<Section className="my-8">
						<Button
							href={verifyUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Verify email address →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						If you didn't create an account with {appName}, you can safely ignore this email. Your email
						address will not be added without confirmation.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default EmailVerify;
