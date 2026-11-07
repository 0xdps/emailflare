import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Tailwind } from "@react-email/components";
import { getThemeConfig } from "../ThemeContext.js";

interface OTPProps {
	name?: string;
	code?: string;
	expiresIn?: string;
}

export const OTP: React.FC<OTPProps> = ({ name = "there", code = "000000", expiresIn = "10 minutes" }) => (
	<Html>
		<Head />
		<Preview>Your verification code: {code}</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Verification code</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, use the code below to verify your identity. It expires in{" "}
						<strong>{expiresIn}</strong>.
					</Text>
					<Section className="my-8 text-center">
						<Text className="text-4xl font-bold tracking-[0.3em] text-email-primary bg-email-primary-subtle rounded-xl px-8 py-6 font-mono">
							{code}
						</Text>
					</Section>
					<Text className="text-email-muted text-sm">
						If you didn't request this code, please ignore this email.
					</Text>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default OTP;
