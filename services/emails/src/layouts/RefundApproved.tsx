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

interface RefundApprovedProps {
	name?: string;
	appName?: string;
	refundAmount?: string;
	originalInvoiceId?: string;
	processedDate?: string;
	receiptUrl?: string;
}

export const RefundApproved: React.FC<RefundApprovedProps> = ({
	name = "there",
	appName = "our app",
	refundAmount = "$0.00",
	originalInvoiceId = "INV-0000",
	processedDate = "today",
	receiptUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your refund has been processed</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Refund processed</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your refund from {appName} has been approved and processed.
					</Text>
					<Section className="bg-green-50 border border-green-200 rounded-xl px-6 py-5 my-6">
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Refund amount:</strong> {refundAmount}
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Invoice:</strong> {originalInvoiceId}
						</Text>
						<Text className="text-email-strong text-sm m-0">
							<strong>Processed on:</strong> {processedDate}
						</Text>
					</Section>
					<Section className="my-8">
						<Button
							href={receiptUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							View refund receipt -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default RefundApproved;
