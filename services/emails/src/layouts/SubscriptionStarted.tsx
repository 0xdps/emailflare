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

interface SubscriptionStartedProps {
	name?: string;
	appName?: string;
	planName?: string;
	amount?: string;
	billingInterval?: string;
	nextBillingDate?: string;
	dashboardUrl?: string;
}

export const SubscriptionStarted: React.FC<SubscriptionStartedProps> = ({
	name = "there",
	appName = "our app",
	planName = "Pro",
	amount = "$0.00",
	billingInterval = "month",
	nextBillingDate = "next month",
	dashboardUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Welcome to {planName} — your subscription is now active</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Section className="text-center mb-4">
						<Text className="text-4xl m-0">🎉</Text>
					</Section>
					<Heading className="text-2xl font-bold text-email-heading mt-0 text-center">
						You're subscribed to {planName}!
					</Heading>
					<Text className="text-email-body text-base leading-relaxed text-center">
						Hi {name}, your {appName} subscription is now active. Here's a summary:
					</Text>
					<Section className="bg-email-primary-subtle border border-email-primary-subtle rounded-xl px-6 py-5 my-6">
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Plan:</strong> {planName}
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Amount:</strong> {amount} / {billingInterval}
						</Text>
						<Text className="text-email-strong text-sm m-0">
							<strong>Next billing date:</strong> {nextBillingDate}
						</Text>
					</Section>
					<Section className="my-8 text-center">
						<Button
							href={dashboardUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Go to dashboard →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						You can manage your subscription at any time from your account settings. To cancel or make
						changes, visit your billing portal.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default SubscriptionStarted;
