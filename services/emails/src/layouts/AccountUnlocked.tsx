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

interface AccountUnlockedProps {
	name?: string;
	appName?: string;
	unlockedAt?: string;
	loginUrl?: string;
}

export const AccountUnlocked: React.FC<AccountUnlockedProps> = ({
	name = "there",
	appName = "our app",
	unlockedAt = "just now",
	loginUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your account is unlocked</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Account unlocked</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {appName} account was unlocked at {unlockedAt}.
					</Text>
					<Section className="my-8">
						<Button
							href={loginUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Sign in
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default AccountUnlocked;
