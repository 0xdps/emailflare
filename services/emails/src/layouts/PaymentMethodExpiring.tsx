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

interface PaymentMethodExpiringProps {
	name?: string;
	appName?: string;
	brand?: string;
	last4?: string;
	expiryMonth?: string;
	expiryYear?: string;
	updatePaymentUrl?: string;
}

export const PaymentMethodExpiring: React.FC<PaymentMethodExpiringProps> = ({
	name = "there",
	appName = "our app",
	brand = "Visa",
	last4 = "4242",
	expiryMonth = "06",
	expiryYear = "2026",
	updatePaymentUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your payment method expires soon</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Payment method expiring</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {appName} payment method expires soon.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>Method:</strong> {brand} •••• {last4}
						<br />
						<strong>Expires:</strong> {expiryMonth}/{expiryYear}
					</Text>
					<Section className="my-8">
						<Button
							href={updatePaymentUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Update payment method
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default PaymentMethodExpiring;
