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

interface FeatureAccessGrantedProps {
	name?: string;
	appName?: string;
	featureName?: string;
	enabledAt?: string;
	docsUrl?: string;
	dashboardUrl?: string;
}

export const FeatureAccessGranted: React.FC<FeatureAccessGrantedProps> = ({
	name = "there",
	appName = "our app",
	featureName = "Advanced Analytics",
	enabledAt = "just now",
	docsUrl = "#",
	dashboardUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Feature access enabled</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Feature enabled</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, {featureName} is now enabled in {appName} as of {enabledAt}.
					</Text>
					<Section className="my-6">
						<Button
							href={dashboardUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Open dashboard
						</Button>
					</Section>
					<Text className="text-email-muted text-sm">Read docs: {docsUrl}</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default FeatureAccessGranted;
