import { useState } from "react";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import DocsNav, { type DocsNavGroup } from "./DocsNav";

interface Props {
	groups: DocsNavGroup[];
	current: string;
}

export default function DocsMobileNav({ groups, current }: Props) {
	const [open, setOpen] = useState(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger render={<Button variant="outline" size="sm" />}>
				<MenuIcon />
				Menu
			</SheetTrigger>
			<SheetContent side="left">
				<SheetHeader>
					<SheetTitle>Documentation</SheetTitle>
				</SheetHeader>
				<div className="overflow-y-auto px-2 pb-6">
					<DocsNav groups={groups} current={current} onNavigate={() => setOpen(false)} />
				</div>
			</SheetContent>
		</Sheet>
	);
}
