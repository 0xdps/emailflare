import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Tailwind } from "@react-email/components";
import { getThemeConfig } from "../ThemeContext.js";

interface PhoneVerifyProps {
	name?: string;
	appName?: string;
	code?: string;
	expiresIn?: string;
}

export const PhoneVerify: React.FC<PhoneVerifyProps> = ({
	name = "there",
	appName = "our app",
	code = "123456",
	expiresIn = "10 minutes",
}) => (
	<Html>
		<Head />
		<Preview>Your phone verification code</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Phone verification</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, use this code to verify your phone in {appName}:
					</Text>
					<Section className="my-6">
						<Text className="text-3xl font-bold tracking-[6px] text-email-primary">{code}</Text>
					</Section>
					<Text className="text-email-muted text-sm">Code expires in {expiresIn}.</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default PhoneVerify;
