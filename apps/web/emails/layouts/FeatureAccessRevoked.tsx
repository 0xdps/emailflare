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

interface FeatureAccessRevokedProps {
	name?: string;
	appName?: string;
	featureName?: string;
	revokedAt?: string;
	reason?: string;
	supportUrl?: string;
}

export const FeatureAccessRevoked: React.FC<FeatureAccessRevokedProps> = ({
	name = "there",
	appName = "our app",
	featureName = "Advanced Analytics",
	revokedAt = "just now",
	reason = "Plan no longer includes this feature",
	supportUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Feature access removed</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Feature access removed</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, access to {featureName} in {appName} was removed at {revokedAt}.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>Reason:</strong> {reason}
					</Text>
					<Section className="my-8">
						<Button
							href={supportUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Contact support
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default FeatureAccessRevoked;
