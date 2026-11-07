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

interface DatabaseCreatedProps {
	name?: string;
	appName?: string;
	databaseName?: string;
	region?: string;
	connectionUrl?: string;
	docsUrl?: string;
}

export const DatabaseCreated: React.FC<DatabaseCreatedProps> = ({
	name = "there",
	appName = "our app",
	databaseName = "main-db",
	region = "us-east-1",
	connectionUrl = "sqlite://example",
	docsUrl = "#",
}) => (
	<Html>
		<Head />
		<Preview>Your database is ready</Preview>
		<Tailwind config={getThemeConfig() as any}>
			<Body className="bg-email-bg font-sans py-8">
				<Container className="bg-email-surface rounded-xl shadow-sm max-w-[600px] mx-auto px-8 py-10">
					<Heading className="text-2xl font-bold text-email-heading mt-0">Database created</Heading>
					<Text className="text-email-body text-base leading-relaxed">
						Hi {name}, your new database in {appName} is ready to use.
					</Text>
					<Section className="bg-email-bg border border-email-border rounded-xl px-6 py-5 my-6">
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Name:</strong> {databaseName}
						</Text>
						<Text className="text-email-strong text-sm m-0 mb-2">
							<strong>Region:</strong> {region}
						</Text>
						<Text className="text-email-strong text-sm m-0">
							<strong>Connection:</strong> {connectionUrl}
						</Text>
					</Section>
					<Section className="my-8">
						<Button
							href={docsUrl}
							className="bg-email-primary text-email-primary-fg font-semibold rounded-lg px-6 py-3 no-underline"
						>
							Open setup docs -&gt;
						</Button>
					</Section>
				</Container>
			</Body>
		</Tailwind>
	</Html>
);

export default DatabaseCreated;
