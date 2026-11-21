// Build-time data for the template library. Layout names, variables and themes are read from the
// dashboard source, so the page cannot drift from what the app ships. Categories and descriptions
// are written here, and the build fails if a layout has none.
import { LAYOUTS, renderLayout } from "../../../../dashboard/emails/render.ts";
import type { LayoutName } from "../../../../dashboard/emails/render.ts";
import { THEMES } from "../../../../dashboard/emails/themes.ts";

export const categories = [
	"Sign-in and verification",
	"Security",
	"Billing",
	"Plans and usage",
	"Product updates",
	"System and data",
] as const;
export type Category = (typeof categories)[number];

const meta: Record<LayoutName, { category: Category; description: string }> = {
	welcome: { category: "Sign-in and verification", description: "Greets a new user and links to the app." },
	"magic-link": { category: "Sign-in and verification", description: "A one-click sign-in link that expires." },
	otp: { category: "Sign-in and verification", description: "A one-time code, shown large for quick copying." },
	"email-verify": {
		category: "Sign-in and verification",
		description: "Asks a new user to confirm their email address.",
	},
	"verification-success": {
		category: "Sign-in and verification",
		description: "Confirms that an email address was verified.",
	},
	"phone-verify": { category: "Sign-in and verification", description: "Sends a code to confirm a phone number." },
	"team-invite": {
		category: "Sign-in and verification",
		description: "Invites someone to a team, with a role and an expiry.",
	},

	"password-reset": { category: "Security", description: "A reset link with an expiry time." },
	"password-changed": { category: "Security", description: "Tells a user their password was changed." },
	"new-login": { category: "Security", description: "Flags a sign-in from a new device or place." },
	"oauth-linked": { category: "Security", description: "Notes that a sign-in provider was linked to the account." },
	"email-change-requested": { category: "Security", description: "Asks the user to confirm a new email address." },
	"email-change-confirmed": { category: "Security", description: "Confirms the account email was updated." },
	"account-locked": { category: "Security", description: "Explains why an account is locked and how to unlock it." },
	"account-unlocked": { category: "Security", description: "Tells a user their account works again." },
	"api-key-created": { category: "Security", description: "Notifies a team that a new API key exists." },
	"api-key-revoked": { category: "Security", description: "Notifies a team that an API key was revoked." },

	"order-confirm": { category: "Billing", description: "Confirms an order with its total and a tracking link." },
	invoice: { category: "Billing", description: "An invoice with an amount, a due date and a pay link." },
	"payment-failed": { category: "Billing", description: "Says a payment failed, why, and how to fix it." },
	"refund-approved": { category: "Billing", description: "Confirms a refund and links to the receipt." },
	"billing-receipt": { category: "Billing", description: "A receipt with the amount and payment method." },
	"payment-method-expiring": { category: "Billing", description: "Warns that a saved card expires soon." },
	"renewal-upcoming": { category: "Billing", description: "A heads-up before a plan renews." },

	"subscription-started": { category: "Plans and usage", description: "Welcomes a customer to a paid plan." },
	"subscription-confirmation": {
		category: "Plans and usage",
		description: "Confirms a subscription with price and cycle.",
	},
	"subscription-cancelled": {
		category: "Plans and usage",
		description: "Confirms a cancellation and offers a way back.",
	},
	"subscription-resumed": {
		category: "Plans and usage",
		description: "Confirms a paused subscription is active again.",
	},
	"trial-ending": { category: "Plans and usage", description: "Counts down the days left in a trial." },
	"plan-upgraded": { category: "Plans and usage", description: "Confirms a move to a higher plan and what it adds." },
	"plan-downgraded": {
		category: "Plans and usage",
		description: "Confirms a move to a lower plan and what changes.",
	},
	"plan-limit-reached": {
		category: "Plans and usage",
		description: "Says a plan limit was reached and links to upgrade.",
	},
	"usage-threshold": { category: "Plans and usage", description: "Warns when usage passes a share of the quota." },
	"feature-access-granted": {
		category: "Plans and usage",
		description: "Tells a user a feature is now on for them.",
	},
	"feature-access-revoked": {
		category: "Plans and usage",
		description: "Tells a user a feature was turned off, with a reason.",
	},

	notification: { category: "Product updates", description: "A general message with one action button." },
	alert: { category: "Product updates", description: "A message with a severity level and an action." },
	digest: { category: "Product updates", description: "A periodic summary with up to three highlights." },
	announcement: { category: "Product updates", description: "Announces a release or news, with a call to action." },
	feedback: {
		category: "Product updates",
		description: "Asks for feedback with a survey link and an optional incentive.",
	},
	plain: { category: "Product updates", description: "A simple message body with an optional button." },
	"support-ticket-reply": { category: "Product updates", description: "Tells a customer a support agent replied." },

	"database-created": {
		category: "System and data",
		description: "Says a new database is ready, with its connection details.",
	},
	"database-deleted": { category: "System and data", description: "Confirms a database was deleted." },
	"backup-ready": { category: "System and data", description: "A backup is ready, with a download link and expiry." },
	"export-ready": { category: "System and data", description: "A data export is ready to download." },
	"import-completed": {
		category: "System and data",
		description: "Reports how many records an import processed and failed.",
	},
	"maintenance-scheduled": {
		category: "System and data",
		description: "Announces planned maintenance with start and end times.",
	},
	"incident-update": { category: "System and data", description: "Posts a status update on an ongoing incident." },
	"account-deleted": { category: "System and data", description: "Confirms an account was deleted." },
};

export interface LayoutInfo {
	slug: string;
	label: string;
	category: Category;
	description: string;
	variables: string[];
}

export const layouts: LayoutInfo[] = (Object.keys(LAYOUTS) as LayoutName[]).map((slug) => {
	const m = meta[slug];
	if (!m) throw new Error(`Template "${slug}" has no category or description in templates-data.ts`);
	return {
		slug,
		label: LAYOUTS[slug].label,
		category: m.category,
		description: m.description,
		variables: LAYOUTS[slug].variables,
	};
});

for (const slug of Object.keys(meta)) {
	if (!(slug in LAYOUTS))
		throw new Error(`templates-data.ts describes "${slug}", which is no longer a built-in layout`);
}

export const themeList = Object.entries(THEMES).map(([id, t]) => ({
	id,
	label: id[0].toUpperCase() + id.slice(1),
	primary: t.primary,
	background: t.bodyBg,
	heading: t.heading,
}));

const samples: Record<string, string> = {
	name: "Alex",
	appName: "Acme",
	title: "Your weekly summary",
	subject: "A quick note",
	message: "Here is what changed since your last visit.",
	body: "Here is what changed since your last visit.",
	code: "482916",
	expiresIn: "15 minutes",
	device: "Chrome on macOS",
	location: "Pune, India",
	orderId: "ORD-1042",
	invoiceId: "INV-2031",
	total: "$49.00",
	amount: "$29.00",
	price: "$29.00",
	refundAmount: "$29.00",
	itemsSummary: "2 items",
	planName: "Pro",
	oldPlanName: "Starter",
	newPlanName: "Pro",
	billingInterval: "Monthly",
	billingCycle: "Monthly",
	daysLeft: "3",
	inviterName: "Sam",
	teamName: "Platform",
	role: "Admin",
	severity: "Warning",
	period: "Weekly",
	highlight1: "42 new signups",
	highlight2: "Delivery rate up 2%",
	highlight3: "3 domains verified",
	version: "2.4",
	ctaLabel: "Read more",
	actionLabel: "View details",
	context: "your recent order",
	incentive: "A month free",
	failureReason: "Card declined",
	featuresGained: "Priority support",
	changeNote: "Some limits are lower on this plan.",
	providerName: "GitHub",
	deviceInfo: "Chrome on macOS",
	databaseName: "orders-db",
	region: "Europe",
	usageType: "Emails sent",
	percentageUsed: "80",
	currentUsage: "800",
	quota: "1,000",
	keyName: "CI deploy",
	keyPreview: "eflive_a1b2c3",
	resourceType: "Domains",
	currentLimit: "3",
	oldEmail: "alex@old.example",
	newEmail: "alex@new.example",
	reason: "Too many failed sign-ins",
	exportType: "Contacts",
	recordsProcessed: "1,204",
	recordsFailed: "3",
	impactSummary: "The dashboard may be unavailable for a few minutes.",
	incidentTitle: "Delayed delivery",
	status: "Investigating",
	latestUpdate: "We are looking into slower delivery for some messages.",
	featureName: "Sequences",
	receiptId: "RCP-884",
	paymentMethod: "Visa ending 4242",
	brand: "Visa",
	last4: "4242",
	expiryMonth: "09",
	expiryYear: "2026",
	ticketId: "T-1187",
	agentName: "Priya",
	messageSnippet: "Thanks for the details. I have reset your domain check.",
	backupId: "BK-209",
	importId: "IMP-77",
	subscriptionId: "SUB-512",
	footerNote: "You are receiving this because you have an account.",
};

const date = "Nov 21, 2026";

function sampleVariables(fields: string[]): Record<string, string> {
	const out: Record<string, string> = {};
	for (const f of fields) {
		if (samples[f]) out[f] = samples[f];
		else if (/Url$/.test(f)) out[f] = "https://app.acme.dev/open";
		else if (/(Date|At|Time)$/.test(f)) out[f] = date;
		else out[f] = f;
	}
	return out;
}

/** Real output of the dashboard's renderer, used for thumbnails and previews. */
export async function previewHtml(slug: string, themeId: string): Promise<string> {
	const spec = LAYOUTS[slug as LayoutName];
	const html = await renderLayout(slug as LayoutName, sampleVariables(spec.variables), themeId);
	return html.replace("<head>", '<head><meta name="robots" content="noindex">');
}
