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

interface EmailChangeRequestedProps {
	name?: string;
	appName?: string;
	oldEmail?: string;
	newEmail?: string;
	confirmUrl?: string;
	expiresIn?: string;
}

export const EmailChangeRequested: React.FC<EmailChangeRequestedProps> = ({
	name = "there",
	appName = "our app",
	oldEmail = "old@example.com",
	newEmail = "new@example.com",
	confirmUrl = "#",
	expiresIn = "30 minutes",
}) => (
	<Html>
		<Head />
		<Preview>Confirm your new email address</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Confirm email change</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, we received a request to change your {appName} email.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>From:</strong> {oldEmail}
						<br />
						<strong>To:</strong> {newEmail}
					</Text>
					<Text className="text-email-strong text-sm">This link expires in {expiresIn}.</Text>
					<Section className="my-8">
						<Button
							href={confirmUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Confirm new email
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default EmailChangeRequested;
