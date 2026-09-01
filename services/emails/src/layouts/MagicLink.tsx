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

interface MagicLinkProps {
	name?: string;
	magicUrl?: string;
	expiresIn?: string;
}

export const MagicLink: React.FC<MagicLinkProps> = ({ name = "there", magicUrl = "#", expiresIn = "15 minutes" }) => (
	<Html>
		<Head />
		<Preview>Your magic sign-in link</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Sign in link ✨</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, click the button below to sign in. This link expires in <strong>{expiresIn}</strong>.
					</Text>
					<Section className="my-8">
						<Button
							href={magicUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Sign in →
						</Button>
					</Section>
					<Text className="text-email-muted text-sm">
						If you didn't request this link, please ignore this email. Your account is safe.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default MagicLink;
