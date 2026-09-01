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

interface AccountDeletedProps {
	name?: string;
	appName?: string;
	deletedAt?: string;
	supportUrl?: string;
}

export const AccountDeleted: React.FC<AccountDeletedProps> = ({
	name = "there",
	appName = "our app",
	deletedAt = "today",
	supportUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your {appName} account has been deleted</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">
						Your account has been deleted
					</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {appName} account was permanently deleted on <strong>{deletedAt}</strong>.
					</Text>
					<Section className="bg-email-bg rounded-lg px-5 py-4 my-6">
						<Text className="text-email-strong text-sm m-0">
							All your data, including settings, history, and associated information, has been permanently
							removed from our systems. This action cannot be undone.
						</Text>
					</Section>
					<Text className="text-email-body text-base leading-relaxed">
						We're sorry to see you go. If you deleted your account by mistake or have any concerns, please
						contact our support team right away.
					</Text>
					<Section className="my-8">
						<Button
							href={supportUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Contact support →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						This is your final email from {appName}. Thank you for using our service.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default AccountDeleted;
