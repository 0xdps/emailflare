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

interface BillingReceiptProps {
	name?: string;
	appName?: string;
	receiptId?: string;
	amount?: string;
	paymentMethod?: string;
	paidAt?: string;
	receiptUrl?: string;
}

export const BillingReceipt: React.FC<BillingReceiptProps> = ({
	name = "there",
	appName = "our app",
	receiptId = "rcpt_12345",
	amount = "$0.00",
	paymentMethod = "Card ending in 4242",
	paidAt = "today",
	receiptUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your payment receipt</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Payment receipt</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, we received your payment in {appName}.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>Receipt:</strong> {receiptId}
						<br />
						<strong>Amount:</strong> {amount}
						<br />
						<strong>Method:</strong> {paymentMethod}
						<br />
						<strong>Paid at:</strong> {paidAt}
					</Text>
					<Section className="my-8">
						<Button
							href={receiptUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							View receipt
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default BillingReceipt;
