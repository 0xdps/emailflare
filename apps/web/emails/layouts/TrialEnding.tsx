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

interface TrialEndingProps {
	name?: string;
	appName?: string;
	trialEndDate?: string;
	daysLeft?: string;
	upgradeUrl?: string;
}

export const TrialEnding: React.FC<TrialEndingProps> = ({
	name = "there",
	appName = "our app",
	trialEndDate = "soon",
	daysLeft = "3",
	upgradeUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>
			Your {appName} trial ends in {daysLeft} days — upgrade to keep access
		</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Section className="bg-amber-50 border border-amber-200 rounded-lg px-5 py-4 mb-6">
						<Text className="text-amber-800 text-sm font-medium m-0">
							⏳ Your free trial is ending soon
						</Text>
					</Section>
					<Heading className="text-2xl font-bold text-email-heading mt-0">
						{daysLeft} days left on your trial
					</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your free trial of {appName} ends on <strong>{trialEndDate}</strong>. After that,
						you'll lose access to all premium features.
					</Text>
					<Text className="text-email-body text-base leading-relaxed">
						Upgrade now to keep everything running without interruption.
					</Text>
					<Section className="my-8">
						<Button
							href={upgradeUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Upgrade now →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						Questions about pricing or what's included? Reply to this email and we'll help find the right
						plan for you.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default TrialEnding;
