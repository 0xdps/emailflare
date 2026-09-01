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

interface MaintenanceScheduledProps {
	name?: string;
	appName?: string;
	startTime?: string;
	endTime?: string;
	impactSummary?: string;
	statusPageUrl?: string;
}

export const MaintenanceScheduled: React.FC<MaintenanceScheduledProps> = ({
	name = "there",
	appName = "our app",
	startTime = "2026-05-10 02:00 UTC",
	endTime = "2026-05-10 03:00 UTC",
	impactSummary = "Brief API interruptions expected",
	statusPageUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Scheduled maintenance notice</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Scheduled maintenance</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, {appName} has scheduled maintenance.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>Start:</strong> {startTime}
						<br />
						<strong>End:</strong> {endTime}
						<br />
						<strong>Impact:</strong> {impactSummary}
					</Text>
					<Section className="my-8">
						<Button
							href={statusPageUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							View status page
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default MaintenanceScheduled;
