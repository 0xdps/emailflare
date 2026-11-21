import type { FaqItem } from "@/components/islands/Faq";
import { site } from "./site";

export const faq: FaqItem[] = [
	{
		q: "What does it cost to run?",
		a: `EmailFlare is free to use and self-host. You pay Cloudflare directly for the Workers, D1, R2, Queues and Email services your usage consumes, on whichever plan you choose. Check <a href="https://developers.cloudflare.com/workers/platform/pricing/" target="_blank" rel="noopener">Cloudflare's pricing</a> for current limits, because they change.`,
	},
	{
		q: "What can I do under the license?",
		a: `EmailFlare uses the <a href="/license">Elastic License 2.0</a>. You can use it, change it and run it for your own company, free. You cannot sell it to others as a hosted or managed service. The source is public, but it is source-available rather than OSI open source.`,
	},
	{
		q: "Does my domain need to be on Cloudflare?",
		a: "Yes. Cloudflare Email Routing and Email Sending work on zones in your Cloudflare account, so a domain must be added there before EmailFlare can route its inbound mail or send from it.",
	},
	{
		q: "Where is my mail stored?",
		a: "In your account. Messages, contacts, logs and keys live in your D1 database, and raw MIME bodies and attachments live in your R2 bucket. EmailFlare has no hosted service and no copy of your data.",
	},
	{
		q: "Can it replace Resend or Postmark?",
		a: `For transactional sending, yes: one <code>POST /v1/send</code>, scoped keys, templates, bounce handling, suppressions and logs. See the <a href="/compare">comparison</a> for the trade-offs, including what a hosted service still does better.`,
	},
	{
		q: "Can it replace a shared inbox like Front or Help Scout?",
		a: `It covers the core: shared mailboxes, threaded conversations, stars, archive, unread state, canned replies and live updates. It does not assign conversations or include a help centre, so check the <a href="/inbox">inbox page</a> against your workflow.`,
	},
	{
		q: "How do I update it?",
		a: `Pull the latest release into your fork and redeploy. The deploy command applies any new D1 migrations before it ships the Worker. The <a href="/changelog">changelog</a> lists what changed in each release.`,
	},
	{
		q: "How do I report a security problem?",
		a: `Use GitHub's private vulnerability reporting on the repository. The <a href="/security">security page</a> explains how reports are handled and what the app does to protect your mail.`,
	},
	{
		q: "Who maintains it?",
		a: `EmailFlare is built by <a href="${site.author.url}" target="_blank" rel="noopener">${site.author.name}</a> under <a href="${site.parent.url}" target="_blank" rel="noopener">${site.parent.name}</a>, with contributors. It is funded by <a href="/sponsor">sponsors</a>.`,
	},
];

export function faqJsonLd(items: FaqItem[] = faq) {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((i) => ({
			"@type": "Question",
			name: i.q,
			acceptedAnswer: { "@type": "Answer", text: i.a.replace(/<[^>]+>/g, "") },
		})),
	};
}
