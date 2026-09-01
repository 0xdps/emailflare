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

interface InvoiceProps {
	name?: string;
	appName?: string;
	invoiceId?: string;
	invoiceDate?: string;
	dueDate?: string;
	total?: string;
	description?: string;
	payUrl?: string;
}

export const Invoice: React.FC<InvoiceProps> = ({
	name = "there",
	appName = "our app",
	invoiceId = "INV-0001",
	invoiceDate = "today",
	dueDate = "in 30 days",
	total = "$0.00",
	description = "Services rendered",
	payUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>
			Invoice {invoiceId} from {appName} — {total} due {dueDate}
		</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Invoice from {appName}</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, please find your invoice below.
					</Text>
					<Hr className="border-email-border my-6" />
					<Section className="my-4">
						<Text className="text-email-muted text-xs uppercase tracking-wide font-semibold m-0 mb-4">
							Invoice details
						</Text>
						<table style={{ width: "100%", borderCollapse: "collapse" }}>
							<tbody>
								<tr>
									<td style={{ padding: "6px 0", color: "#64748b", fontSize: "14px" }}>Invoice #</td>
									<td
										style={{
											padding: "6px 0",
											color: "#1e293b",
											fontSize: "14px",
											textAlign: "right",
											fontWeight: "600",
										}}
									>
										{invoiceId}
									</td>
								</tr>
								<tr>
									<td style={{ padding: "6px 0", color: "#64748b", fontSize: "14px" }}>Issue date</td>
									<td
										style={{
											padding: "6px 0",
											color: "#1e293b",
											fontSize: "14px",
											textAlign: "right",
										}}
									>
										{invoiceDate}
									</td>
								</tr>
								<tr>
									<td style={{ padding: "6px 0", color: "#64748b", fontSize: "14px" }}>Due date</td>
									<td
										style={{
											padding: "6px 0",
											color: "#1e293b",
											fontSize: "14px",
											textAlign: "right",
										}}
									>
										{dueDate}
									</td>
								</tr>
								<tr>
									<td style={{ padding: "6px 0", color: "#64748b", fontSize: "14px" }}>
										Description
									</td>
									<td
										style={{
											padding: "6px 0",
											color: "#1e293b",
											fontSize: "14px",
											textAlign: "right",
										}}
									>
										{description}
									</td>
								</tr>
							</tbody>
						</table>
					</Section>
					<Hr className="border-email-border my-4" />
					<Section className="my-4">
						<table style={{ width: "100%" }}>
							<tbody>
								<tr>
									<td style={{ color: "#0f172a", fontSize: "18px", fontWeight: "700" }}>Total due</td>
									<td
										style={{
											color: "#f97316",
											fontSize: "24px",
											fontWeight: "700",
											textAlign: "right",
										}}
									>
										{total}
									</td>
								</tr>
							</tbody>
						</table>
					</Section>
					<Section className="my-8">
						<Button
							href={payUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Pay invoice →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						This invoice was issued by {appName}. If you have questions, please reply to this email.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default Invoice;
