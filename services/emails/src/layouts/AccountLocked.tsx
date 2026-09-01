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

interface AccountLockedProps {
	name?: string;
	appName?: string;
	reason?: string;
	lockedUntil?: string;
	unlockUrl?: string;
	supportUrl?: string;
}

export const AccountLocked: React.FC<AccountLockedProps> = ({
	name = "there",
	appName = "our app",
	reason = "Too many failed attempts",
	lockedUntil = "30 minutes from now",
	unlockUrl = "#",
	supportUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your account has been temporarily locked</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-red-700 mt-0">Account locked</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {appName} account was temporarily locked.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>Reason:</strong> {reason}
						<br />
						<strong>Locked until:</strong> {lockedUntil}
					</Text>
					<Section className="my-6">
						<Button
							href={unlockUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Unlock account
						</Button>
					</Section>
					<Text className="text-email-muted text-sm">Need help? {supportUrl}</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default AccountLocked;
