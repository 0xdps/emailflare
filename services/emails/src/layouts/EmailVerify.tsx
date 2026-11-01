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
	code?: string;
	expiresIn?: string;
}

export const EmailVerify: React.FC<EmailVerifyProps> = ({
	name = "there",
	appName = "our app",
	verifyUrl,
	code,
	expiresIn = "10 minutes",
}) => {
	return (
		<Html>
			<Head />
			<Preview>Verify your email address for {appName}</Preview>
			<Tailwind config={getThemeConfig() as any}>
				<Body className="bg-email-bg font-sans py-8">
					<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
						<Heading className="text-2xl font-bold text-email-heading mt-0">
							Confirm your email address
						</Heading>
						<Text className="text-email-body text-base leading-relaxed">
							Hi {name}, use the button or verification code below to sign in to {appName}. This link and
							code will expire in <strong>{expiresIn}</strong>.
						</Text>

						{verifyUrl && (
							<Section className="my-8 text-center">
								<Button
									href={verifyUrl}
									className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline inline-block"
								>
									Sign in with one click →
								</Button>
							</Section>
						)}

						{code && (
							<Section className="my-6">
								{verifyUrl && (
									<Text className="text-email-body text-sm font-medium mb-3 text-center">
										Or enter this code manually:
									</Text>
								)}
								<div className="text-center">
									<Text className="text-3xl font-bold tracking-[0.25em] text-email-primary bg-email-primary-subtle rounded-xl px-6 py-4 font-mono inline-block m-0">
										{code}
									</Text>
								</div>
							</Section>
						)}

						<Hr className="border-email-border my-6" />
						<Text className="text-email-muted text-sm">
							If you didn't request this email from {appName}, you can safely ignore it.
						</Text>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default EmailVerify;
