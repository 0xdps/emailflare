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

interface SubscriptionConfirmationProps {
	name?: string;
	appName?: string;
	planName?: string;
	price?: string;
	billingCycle?: string;
	nextBillingDate?: string;
	subscriptionId?: string;
	invoiceUrl?: string;
}

export const SubscriptionConfirmation: React.FC<SubscriptionConfirmationProps> = ({
	name = "there",
	appName = "our app",
	planName = "Pro",
	price = "$0.00",
	billingCycle = "monthly",
	nextBillingDate = "next month",
	subscriptionId = "sub_12345",
	invoiceUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your subscription is confirmed</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Subscription confirmed</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {appName} subscription is active.
					</Text>
					<Section className="bg-email-primary-subtle border border-email-primary-subtle rounded-xl px-6 py-5 my-6">
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Plan:</strong> {planName}
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Price:</strong> {price} ({billingCycle})
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Next billing:</strong> {nextBillingDate}
						</Text>
						<Text className="text-email-strong text-sm m-0">
							<strong>Subscription:</strong> {subscriptionId}
						</Text>
					</Section>
					<Section className="my-8">
						<Button
							href={invoiceUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							View invoice -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default SubscriptionConfirmation;
