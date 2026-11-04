import type { Metadata } from "next";
import { UserProvider } from "@/lib/UserContext";
import "./globals.css";

export const metadata: Metadata = {
	title: "EmailFlare",
	description: "Transactional email and team inbox",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en">
			<body>
				<UserProvider>{children}</UserProvider>
			</body>
		</html>
	);
}
