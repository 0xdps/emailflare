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

interface ApiKeyRevokedProps {
	name?: string;
	appName?: string;
	keyName?: string;
	revokedDate?: string;
	dashboardUrl?: string;
}

export const ApiKeyRevoked: React.FC<ApiKeyRevokedProps> = ({
	name = "there",
	appName = "our app",
	keyName = "Production key",
	revokedDate = "just now",
	dashboardUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>API key revoked</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">API key revoked</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, API key <strong>{keyName}</strong> was revoked on {revokedDate}.
					</Text>
					<Section className="my-8">
						<Button
							href={dashboardUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Manage API keys -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default ApiKeyRevoked;
