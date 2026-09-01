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

interface SupportTicketReplyProps {
	name?: string;
	appName?: string;
	ticketId?: string;
	agentName?: string;
	messageSnippet?: string;
	ticketUrl?: string;
}

export const SupportTicketReply: React.FC<SupportTicketReplyProps> = ({
	name = "there",
	appName = "our app",
	ticketId = "TKT-1001",
	agentName = "Support Team",
	messageSnippet = "We have an update on your request.",
	ticketUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Update on your support ticket</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Support ticket update</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, {agentName} replied to your {appName} ticket {ticketId}.
					</Text>
					<Text className="text-email-strong text-sm">"{messageSnippet}"</Text>
					<Section className="my-8">
						<Button
							href={ticketUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							View ticket
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default SupportTicketReply;
