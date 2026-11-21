import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface Props {
	links: { label: string; href: string }[];
	deployHref: string;
	repoHref: string;
}

export default function MobileNav({ links, deployHref, repoHref }: Props) {
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden" />}>
				<MenuIcon />
			</SheetTrigger>
			<SheetContent side="right">
				<SheetHeader>
					<SheetTitle>EmailFlare</SheetTitle>
				</SheetHeader>
				<nav className="flex flex-col gap-1 px-4" aria-label="Mobile">
					{links.map((l) => (
						<a
							key={l.href}
							href={l.href}
							onClick={() => setOpen(false)}
							className="hover:bg-muted rounded-lg px-3 py-2.5 text-base font-medium"
						>
							{l.label}
						</a>
					))}
				</nav>
				<div className="mt-auto flex flex-col gap-2 p-4">
					<Button size="xl" render={<a href={deployHref} />} nativeButton={false}>
						Deploy to Cloudflare
					</Button>
					<Button size="xl" variant="outline" render={<a href={repoHref} />} nativeButton={false}>
						View on GitHub
					</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
}
