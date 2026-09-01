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

interface DatabaseDeletedProps {
	name?: string;
	appName?: string;
	databaseName?: string;
	deletionDate?: string;
	supportUrl?: string;
}

export const DatabaseDeleted: React.FC<DatabaseDeletedProps> = ({
	name = "there",
	appName = "our app",
	databaseName = "main-db",
	deletionDate = "just now",
	supportUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your database was deleted</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Database deleted</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, the database <strong>{databaseName}</strong> was deleted from {appName} on{" "}
						{deletionDate}.
					</Text>
					<Text className="text-email-body text-base leading-relaxed">
						If this was unexpected, contact support immediately.
					</Text>
					<Section className="my-8">
						<Button
							href={supportUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Contact support -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default DatabaseDeleted;
