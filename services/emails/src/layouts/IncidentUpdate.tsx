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

interface IncidentUpdateProps {
	name?: string;
	appName?: string;
	incidentTitle?: string;
	status?: string;
	startedAt?: string;
	latestUpdate?: string;
	statusPageUrl?: string;
}

export const IncidentUpdate: React.FC<IncidentUpdateProps> = ({
	name = "there",
	appName = "our app",
	incidentTitle = "Service degradation",
	status = "investigating",
	startedAt = "just now",
	latestUpdate = "Our team is actively investigating.",
	statusPageUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Incident update</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Incident update</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, here is an update for {appName}.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>Incident:</strong> {incidentTitle}
						<br />
						<strong>Status:</strong> {status}
						<br />
						<strong>Started:</strong> {startedAt}
					</Text>
					<Text className="text-email-strong text-sm">{latestUpdate}</Text>
					<Section className="my-8">
						<Button
							href={statusPageUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Follow live updates
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default IncidentUpdate;
