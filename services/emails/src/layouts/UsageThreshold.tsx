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

interface UsageThresholdProps {
	name?: string;
	appName?: string;
	usageType?: string;
	percentageUsed?: string;
	currentUsage?: string;
	quota?: string;
	upgradeUrl?: string;
}

export const UsageThreshold: React.FC<UsageThresholdProps> = ({
	name = "there",
	appName = "our app",
	usageType = "API calls",
	percentageUsed = "80",
	currentUsage = "8,000",
	quota = "10,000",
	upgradeUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Usage alert: nearing your limit</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Usage alert</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {usageType} usage in {appName} has reached {percentageUsed}% of quota.
					</Text>
					<Section className="bg-yellow-50 border border-yellow-200 rounded-xl px-6 py-5 my-6">
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Current:</strong> {currentUsage}
						</Text>
						<Text className="text-email-strong text-sm m-0">
							<strong>Quota:</strong> {quota}
						</Text>
					</Section>
					<Section className="my-8">
						<Button
							href={upgradeUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Upgrade plan -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default UsageThreshold;
