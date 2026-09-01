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

interface PlanDowngradedProps {
	name?: string;
	appName?: string;
	oldPlanName?: string;
	newPlanName?: string;
	effectiveDate?: string;
	changeNote?: string;
	dashboardUrl?: string;
}

export const PlanDowngraded: React.FC<PlanDowngradedProps> = ({
	name = "there",
	appName = "our app",
	oldPlanName = "Pro",
	newPlanName = "Starter",
	effectiveDate = "today",
	changeNote = "Some limits may be reduced on your account.",
	dashboardUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your plan was downgraded</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Plan downgraded</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {appName} plan changed from {oldPlanName} to {newPlanName}.
					</Text>
					<Text className="text-email-strong text-base leading-relaxed">
						Effective date: <strong>{effectiveDate}</strong>
						<br />
						{changeNote}
					</Text>
					<Section className="my-8">
						<Button
							href={dashboardUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Review account limits -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default PlanDowngraded;
