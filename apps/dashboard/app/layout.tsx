import type { Metadata } from "next";
import { UserProvider } from "@/lib/UserContext";
import ThemeProvider from "@/components/app/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
	title: "EmailFlare",
	description: "Transactional email and team inbox",
	icons: {
		icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
	},
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<ThemeProvider>
					<TooltipProvider delay={300}>
						<UserProvider>{children}</UserProvider>
					</TooltipProvider>
					<Toaster position="bottom-right" />
				</ThemeProvider>
			</body>
		</html>
	);
}
