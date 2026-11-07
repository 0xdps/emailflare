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

interface ExportReadyProps {
	name?: string;
	appName?: string;
	exportType?: string;
	requestedAt?: string;
	expiresAt?: string;
	downloadUrl?: string;
}

export const ExportReady: React.FC<ExportReadyProps> = ({
	name = "there",
	appName = "our app",
	exportType = "full data",
	requestedAt = "earlier today",
	expiresAt = "in 72 hours",
	downloadUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your export is ready</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Export ready</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {exportType} export from {appName} is ready.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>Requested:</strong> {requestedAt}
						<br />
						<strong>Expires:</strong> {expiresAt}
					</Text>
					<Section className="my-8">
						<Button
							href={downloadUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Download export
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default ExportReady;
