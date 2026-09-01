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

interface RenewalUpcomingProps {
	name?: string;
	appName?: string;
	planName?: string;
	amount?: string;
	billingDate?: string;
	viewInvoiceUrl?: string;
}

export const RenewalUpcoming: React.FC<RenewalUpcomingProps> = ({
	name = "there",
	appName = "our app",
	planName = "Pro",
	amount = "$0.00",
	billingDate = "tomorrow",
	viewInvoiceUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Upcoming subscription renewal</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Renewal reminder</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {appName} {planName} subscription renews on {billingDate}.
					</Text>
					<Text className="text-email-strong text-base leading-relaxed">
						Amount due: <strong>{amount}</strong>
					</Text>
					<Section className="my-8">
						<Button
							href={viewInvoiceUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							View billing details -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default RenewalUpcoming;
