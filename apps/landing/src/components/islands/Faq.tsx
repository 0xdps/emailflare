import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export interface FaqItem {
	q: string;
	/** Plain text or inline HTML (links) */
	a: string;
}

export default function Faq({ items }: { items: FaqItem[] }) {
	return (
		<Accordion className="divide-border border-border divide-y rounded-2xl border">
			{items.map((item, i) => (
				<AccordionItem key={i} value={i} className="px-5 !border-0">
					<AccordionTrigger className="py-4 text-base">{item.q}</AccordionTrigger>
					<AccordionContent className="text-muted-foreground text-[0.9375rem] leading-7 [&_a]:text-foreground">
						<div dangerouslySetInnerHTML={{ __html: item.a }} />
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
