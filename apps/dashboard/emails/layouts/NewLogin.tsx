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

interface NewLoginProps {
	name?: string;
	appName?: string;
	device?: string;
	location?: string;
	time?: string;
	secureUrl?: string;
}

export const NewLogin: React.FC<NewLoginProps> = ({
	name = "there",
	appName = "our app",
	device = "Unknown device",
	location = "Unknown location",
	time = "just now",
	secureUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>New sign-in to your {appName} account</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Section className="bg-blue-50 border border-blue-200 rounded-lg px-5 py-4 mb-6">
						<Text className="text-blue-800 text-sm font-medium m-0">🔔 New sign-in detected</Text>
					</Section>
					<Heading className="text-2xl font-bold text-email-heading mt-0">
						New sign-in to your account
					</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, we noticed a new sign-in to your {appName} account.
					</Text>
					<Section className="bg-email-bg rounded-lg px-5 py-4 my-6">
						<Text className="text-email-muted text-xs uppercase tracking-wide font-semibold m-0 mb-3">
							Sign-in details
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-1">
							<strong>Device:</strong> {device}
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-1">
							<strong>Location:</strong> {location}
						</Text>
						<Text className="text-email-strong text-sm m-0">
							<strong>Time:</strong> {time}
						</Text>
					</Section>
					<Text className="text-email-body text-base leading-relaxed">
						If this was you, no action is required. If you don't recognize this sign-in, secure your account
						immediately.
					</Text>
					<Section className="my-6">
						<Button
							href={secureUrl}
							className="bg-red-500 text-white font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Secure my account →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						This security alert was sent by {appName}. You'll receive these alerts whenever a new device
						signs in to your account.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default NewLogin;
