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

interface SubscriptionCancelledProps {
	name?: string;
	appName?: string;
	planName?: string;
	endDate?: string;
	resubscribeUrl?: string;
}

export const SubscriptionCancelled: React.FC<SubscriptionCancelledProps> = ({
	name = "there",
	appName = "our app",
	planName = "Pro",
	endDate = "end of current period",
	resubscribeUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your {appName} subscription has been cancelled</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">
						Your subscription has been cancelled
					</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, we're sorry to see you go. Your {appName} <strong>{planName}</strong> subscription
						has been cancelled.
					</Text>
					<Section className="bg-email-bg rounded-lg px-5 py-4 my-6">
						<Text className="text-email-strong text-sm m-0">
							You'll continue to have access to your {planName} features until <strong>{endDate}</strong>.
							After that, your account will revert to the free plan.
						</Text>
					</Section>
					<Text className="text-email-body text-base leading-relaxed">
						We'd love to have you back. You can reactivate your subscription at any time.
					</Text>
					<Section className="my-8">
						<Button
							href={resubscribeUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Reactivate subscription →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						If you cancelled by mistake or have feedback for us, please reply to this email — we read every
						response.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default SubscriptionCancelled;
