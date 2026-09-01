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

interface PlanLimitReachedProps {
	name?: string;
	appName?: string;
	resourceType?: string;
	currentLimit?: string;
	planName?: string;
	upgradeUrl?: string;
}

export const PlanLimitReached: React.FC<PlanLimitReachedProps> = ({
	name = "there",
	appName = "our app",
	resourceType = "databases",
	currentLimit = "3",
	planName = "free",
	upgradeUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Plan limit reached</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Plan limit reached</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {planName} plan in {appName} has reached its limit for {resourceType}.
					</Text>
					<Section className="bg-yellow-50 border border-yellow-200 rounded-xl px-6 py-5 my-6">
						<Text className="text-email-strong text-sm m-0">
							<strong>Current limit:</strong> {currentLimit} {resourceType}
						</Text>
					</Section>
					<Section className="my-8">
						<Button
							href={upgradeUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Upgrade plan -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default PlanLimitReached;
