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

interface ApiKeyCreatedProps {
	name?: string;
	appName?: string;
	keyName?: string;
	createdDate?: string;
	keyPreview?: string;
	revokeUrl?: string;
}

export const ApiKeyCreated: React.FC<ApiKeyCreatedProps> = ({
	name = "there",
	appName = "our app",
	keyName = "Production key",
	createdDate = "just now",
	keyPreview = "shs_xxxx...abcd",
	revokeUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>New API key created</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">API key created</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, a new API key was created for your {appName} account.
					</Text>
					<Section className="bg-email-bg border border-email-border rounded-xl px-6 py-5 my-6">
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Name:</strong> {keyName}
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Created:</strong> {createdDate}
						</Text>
						<Text className="text-email-strong text-sm m-0">
							<strong>Preview:</strong> {keyPreview}
						</Text>
					</Section>
					<Section className="my-8">
						<Button
							href={revokeUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Revoke key if unauthorized -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default ApiKeyCreated;
