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

interface SubscriptionResumedProps {
	name?: string;
	appName?: string;
	planName?: string;
	renewalDate?: string;
	amount?: string;
	dashboardUrl?: string;
}

export const SubscriptionResumed: React.FC<SubscriptionResumedProps> = ({
	name = "there",
	appName = "our app",
	planName = "Pro",
	renewalDate = "next billing cycle",
	amount = "$0.00",
	dashboardUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your subscription has been resumed</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Subscription resumed</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {appName} {planName} subscription is active again.
					</Text>
					<Text className="text-email-strong text-base leading-relaxed">
						Renewal date: <strong>{renewalDate}</strong>
						<br />
						Recurring amount: <strong>{amount}</strong>
					</Text>
					<Section className="my-8">
						<Button
							href={dashboardUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Open billing dashboard -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default SubscriptionResumed;
