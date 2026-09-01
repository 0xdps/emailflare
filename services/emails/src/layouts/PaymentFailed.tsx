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

interface PaymentFailedProps {
	name?: string;
	appName?: string;
	planName?: string;
	amount?: string;
	failureReason?: string;
	gracePeriodEnd?: string;
	retryUrl?: string;
	updatePaymentUrl?: string;
}

export const PaymentFailed: React.FC<PaymentFailedProps> = ({
	name = "there",
	appName = "our app",
	planName = "Pro",
	amount = "$0.00",
	failureReason = "Card was declined",
	gracePeriodEnd = "in 7 days",
	retryUrl = "#",
	updatePaymentUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Payment failed - action required</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-red-700 mt-0">Payment failed</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, we could not process your {appName} payment for {planName}.
					</Text>
					<Section className="bg-red-50 border border-red-200 rounded-xl px-6 py-5 my-6">
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Amount:</strong> {amount}
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Reason:</strong> {failureReason}
						</Text>
						<Text className="text-email-strong text-sm m-0">
							<strong>Grace period ends:</strong> {gracePeriodEnd}
						</Text>
					</Section>
					<Section className="my-6">
						<Button
							href={retryUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Retry payment -&gt;
						</Button>
					</Section>
					<Section>
						<Button
							href={updatePaymentUrl}
							className="bg-email-secondary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Update payment method -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default PaymentFailed;
