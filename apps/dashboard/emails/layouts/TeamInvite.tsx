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

interface TeamInviteProps {
	name?: string;
	inviterName?: string;
	teamName?: string;
	appName?: string;
	role?: string;
	inviteUrl?: string;
	expiresIn?: string;
}

export const TeamInvite: React.FC<TeamInviteProps> = ({
	name = "there",
	inviterName = "A teammate",
	teamName = "our team",
	appName = "our app",
	role = "Member",
	inviteUrl = "#",
	expiresIn = "7 days",
}) => (
	<Html>
		<Head />
		<Preview>
			{inviterName} invited you to join {teamName} on {appName}
		</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">
						You've been invited to {teamName}
					</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, <strong>{inviterName}</strong> has invited you to join <strong>{teamName}</strong> on{" "}
						{appName} as a <strong>{role}</strong>.
					</Text>
					<Text className="text-email-body text-base leading-relaxed">
						Click the button below to accept this invitation. The invite expires in{" "}
						<strong>{expiresIn}</strong>.
					</Text>
					<Section className="my-8">
						<Button
							href={inviteUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Accept invitation →
						</Button>
					</Section>
					<Hr className="border-email-border my-6" />
					<Text className="text-email-muted text-sm">
						If you weren't expecting this invitation or don't know {inviterName}, you can safely ignore this
						email.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default TeamInvite;
