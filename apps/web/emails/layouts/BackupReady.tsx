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

interface BackupReadyProps {
	name?: string;
	appName?: string;
	backupId?: string;
	createdAt?: string;
	expiresAt?: string;
	downloadUrl?: string;
}

export const BackupReady: React.FC<BackupReadyProps> = ({
	name = "there",
	appName = "our app",
	backupId = "bkp_12345",
	createdAt = "just now",
	expiresAt = "in 7 days",
	downloadUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your backup is ready</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Backup ready</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your {appName} backup is ready for download.
					</Text>
					<Text className="text-email-strong text-sm">
						<strong>ID:</strong> {backupId}
						<br />
						<strong>Created:</strong> {createdAt}
						<br />
						<strong>Expires:</strong> {expiresAt}
					</Text>
					<Section className="my-8">
						<Button
							href={downloadUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Download backup
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default BackupReady;
