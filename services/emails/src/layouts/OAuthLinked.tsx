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

interface OAuthLinkedProps {
	name?: string;
	appName?: string;
	providerName?: string;
	linkedDate?: string;
	deviceInfo?: string;
	secureUrl?: string;
}

export const OAuthLinked: React.FC<OAuthLinkedProps> = ({
	name = "there",
	appName = "our app",
	providerName = "Google",
	linkedDate = "just now",
	deviceInfo = "Unknown device",
	secureUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Security alert: new OAuth account linked</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">
						New sign-in provider linked
					</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, a {providerName} account was linked to your {appName} profile.
					</Text>
					<Section className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-5 my-6">
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Provider:</strong> {providerName}
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Time:</strong> {linkedDate}
						</Text>
						<Text className="text-email-strong text-sm m-0">
							<strong>Device:</strong> {deviceInfo}
						</Text>
					</Section>
					<Section className="my-8">
						<Button
							href={secureUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Review account security -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default OAuthLinked;
