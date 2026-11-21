import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface Shot {
	id: string;
	label: string;
	title: string;
	body: string;
	/** Base file name in /shots, e.g. "inbox" -> inbox-light.webp / inbox-dark.webp */
	file: string;
	alt: string;
}

/** Product tour. The frame is a perforated stamp; each tab swaps a real dashboard screenshot. */
export default function ProductTour({ shots }: { shots: Shot[] }) {
	return (
		<Tabs defaultValue={shots[0].id} className="gap-8">
			<TabsList variant="line" className="h-auto w-full flex-wrap justify-center gap-x-2 gap-y-1">
				{shots.map((s) => (
					<TabsTrigger
						key={s.id}
						value={s.id}
						className="data-active:text-foreground flex-none px-3 py-1.5 text-sm after:!bottom-0"
					>
						{s.label}
					</TabsTrigger>
				))}
			</TabsList>
			{shots.map((s) => (
				<TabsContent
					key={s.id}
					value={s.id}
					className="grid items-start gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]"
				>
					<div className="lg:pt-6">
						<h3 className="text-2xl font-semibold">{s.title}</h3>
						<p className="text-muted-foreground mt-3 text-[0.9375rem] leading-7">{s.body}</p>
					</div>
					<div className="stamp">
						<img
							src={`/shots/${s.file}-light.webp`}
							alt={s.alt}
							width={1800}
							height={1125}
							loading="lazy"
							className="border-border block w-full rounded-sm border dark:hidden"
						/>
						<img
							src={`/shots/${s.file}-dark.webp`}
							alt={s.alt}
							width={1800}
							height={1125}
							loading="lazy"
							className="border-border hidden w-full rounded-sm border dark:block"
						/>
					</div>
				</TabsContent>
			))}
		</Tabs>
	);
}
