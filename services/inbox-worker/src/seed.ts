// Seed the system email templates into D1.
// Call once after applying migrations: POST /api/_seed (admin token required).

import { generateId } from "@emailflare/email-core";
import { makeDb } from "./db.ts";
import { LAYOUTS } from "./emails.ts";
import type { LayoutName } from "./emails.ts";

const SYSTEM_SUBJECTS: Record<LayoutName, string> = {
	welcome: "Welcome to {{appName}}, {{name}}!",
	"magic-link": "Your sign-in link for {{appName}}",
	notification: "{{title}}",
	otp: "Your {{appName}} verification code: {{code}}",
	"email-verify": "Verify your email address for {{appName}}",
	"password-reset": "Reset your {{appName}} password",
	"password-changed": "Your {{appName}} password has been changed",
	"new-login": "New sign-in to your {{appName}} account",
	"order-confirm": "Order #{{orderId}} confirmed",
	invoice: "Invoice #{{invoiceId}} from {{appName}}",
	"subscription-started": "Welcome to {{planName}} — your subscription is active",
	"subscription-cancelled": "Your {{appName}} subscription has been cancelled",
	"trial-ending": "Your {{appName}} trial ends in {{daysLeft}} days",
	"team-invite": "{{inviterName}} invited you to join {{teamName}}",
	alert: "[{{severity}}] {{title}}",
	digest: "Your {{period}} digest — {{appName}}",
	announcement: "{{title}}",
	feedback: "Share your feedback — {{appName}}",
	"account-deleted": "Your {{appName}} account has been deleted",
	plain: "{{subject}}",
	"verification-success": "Your email was verified for {{appName}}",
	"subscription-confirmation": "Your {{appName}} subscription is confirmed",
	"payment-failed": "Payment failed for your {{appName}} subscription",
	"renewal-upcoming": "Upcoming renewal for {{appName}}",
	"subscription-resumed": "Your {{appName}} subscription is active again",
	"refund-approved": "Your refund from {{appName}} has been processed",
	"plan-upgraded": "Your {{appName}} plan was upgraded",
	"plan-downgraded": "Your {{appName}} plan was downgraded",
	"oauth-linked": "Security alert: new sign-in provider linked",
	"database-created": "Your database {{databaseName}} is ready",
	"database-deleted": "Database {{databaseName}} was deleted",
	"usage-threshold": "{{appName}} usage alert: {{percentageUsed}}% used",
	"api-key-created": "New API key created in {{appName}}",
	"api-key-revoked": "API key {{keyName}} revoked in {{appName}}",
	"plan-limit-reached": "Plan limit reached for {{resourceType}} in {{appName}}",
	"email-change-requested": "Confirm your new email for {{appName}}",
	"email-change-confirmed": "Your email address was updated in {{appName}}",
	"phone-verify": "Your {{appName}} phone verification code: {{code}}",
	"account-locked": "Your {{appName}} account has been locked",
	"account-unlocked": "Your {{appName}} account has been unlocked",
	"backup-ready": "Your {{appName}} backup is ready to download",
	"export-ready": "Your {{appName}} export is ready",
	"import-completed": "Your {{appName}} import has completed",
	"maintenance-scheduled": "Scheduled maintenance for {{appName}}",
	"incident-update": "Incident update: {{incidentTitle}}",
	"feature-access-granted": "Feature enabled: {{featureName}} in {{appName}}",
	"feature-access-revoked": "Feature access removed: {{featureName}}",
	"billing-receipt": "Your {{appName}} payment receipt {{receiptId}}",
	"payment-method-expiring": "Your payment method for {{appName}} expires soon",
	"support-ticket-reply": "Update on your support ticket {{ticketId}}",
};

export async function seedSystemTemplates(d1: D1Database): Promise<void> {
	const { templates } = makeDb(d1);
	const now = new Date().toISOString();

	for (const [layoutId, { label }] of Object.entries(LAYOUTS) as [
		LayoutName,
		{ label: string; variables: string[] },
	][]) {
		const existing = await templates.findOne({ where: { slug: layoutId } });
		if (!existing) {
			await templates.insert({
				id: generateId(),
				name: label,
				slug: layoutId,
				subject: SYSTEM_SUBJECTS[layoutId],
				html_body: "",
				text_body: null,
				layout: layoutId,
				is_system: 1,
				domain_id: null,
				created_at: now,
				updated_at: now,
			});
		}
	}
}
