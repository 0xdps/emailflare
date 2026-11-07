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
} from "@react-email/components";
import { getThemeConfig } from "../ThemeContext.js";

interface VerificationSuccessProps {
	name?: string;
	appName?: string;
	confirmationTime?: string;
	loginUrl?: string;
}

export const VerificationSuccess: React.FC<VerificationSuccessProps> = ({
	name = "there",
	appName = "our app",
	confirmationTime = "just now",
	loginUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your email was verified successfully</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">
						Email verified successfully
					</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your email for {appName} was verified at {confirmationTime}.
					</Text>
					<Section className="my-8">
						<Button
							href={loginUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Continue to account -&gt;
						</Button>
					</Section>
					<Text className="text-email-muted text-sm">
						If this was not you, secure your account immediately.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default VerificationSuccess;
