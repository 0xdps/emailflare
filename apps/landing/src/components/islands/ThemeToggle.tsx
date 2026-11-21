import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const THEME_KEY = "ef-theme";

export default function ThemeToggle() {
	const [dark, setDark] = useState(false);

	useEffect(() => {
		setDark(document.documentElement.classList.contains("dark"));
	}, []);

	function toggle() {
		const next = !dark;
		document.documentElement.classList.toggle("dark", next);
		localStorage.setItem(THEME_KEY, next ? "dark" : "light");
		setDark(next);
	}

	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={toggle}
			aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
		>
			{dark ? <SunIcon /> : <MoonIcon />}
		</Button>
	);
}
