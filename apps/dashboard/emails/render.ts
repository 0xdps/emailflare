import { THEMES, type EmailTheme } from "./themes.js";

export type LayoutName =
	| "welcome"
	| "magic-link"
	| "notification"
	| "otp"
	| "email-verify"
	| "password-reset"
	| "password-changed"
	| "new-login"
	| "order-confirm"
	| "invoice"
	| "subscription-started"
	| "subscription-cancelled"
	| "trial-ending"
	| "team-invite"
	| "alert"
	| "digest"
	| "announcement"
	| "feedback"
	| "account-deleted"
	| "plain"
	| "verification-success"
	| "subscription-confirmation"
	| "payment-failed"
	| "renewal-upcoming"
	| "subscription-resumed"
	| "refund-approved"
	| "plan-upgraded"
	| "plan-downgraded"
	| "oauth-linked"
	| "database-created"
	| "database-deleted"
	| "usage-threshold"
	| "api-key-created"
	| "api-key-revoked"
	| "plan-limit-reached"
	| "email-change-requested"
	| "email-change-confirmed"
	| "phone-verify"
	| "account-locked"
	| "account-unlocked"
	| "backup-ready"
	| "export-ready"
	| "import-completed"
	| "maintenance-scheduled"
	| "incident-update"
	| "feature-access-granted"
	| "feature-access-revoked"
	| "billing-receipt"
	| "payment-method-expiring"
	| "support-ticket-reply";

export const LAYOUTS: Record<LayoutName, { label: string; variables: string[] }> = {
	welcome: { label: "Welcome", variables: ["name", "appName", "loginUrl"] },
	"magic-link": { label: "Magic Link", variables: ["name", "magicUrl", "expiresIn"] },
	notification: { label: "Notification", variables: ["name", "title", "message", "actionUrl", "actionLabel"] },
	otp: { label: "OTP Code", variables: ["name", "code", "expiresIn"] },
	"email-verify": { label: "Email Verification", variables: ["name", "appName", "verifyUrl", "expiresIn"] },
	"password-reset": { label: "Password Reset", variables: ["name", "appName", "resetUrl", "expiresIn"] },
	"password-changed": { label: "Password Changed", variables: ["name", "appName", "changedAt", "supportUrl"] },
	"new-login": {
		label: "New Login Alert",
		variables: ["name", "appName", "device", "location", "time", "secureUrl"],
	},
	"order-confirm": {
		label: "Order Confirmation",
		variables: ["name", "orderId", "orderDate", "total", "itemsSummary", "trackingUrl"],
	},
	invoice: {
		label: "Invoice",
		variables: ["name", "appName", "invoiceId", "invoiceDate", "dueDate", "total", "description", "payUrl"],
	},
	"subscription-started": {
		label: "Subscription Started",
		variables: ["name", "appName", "planName", "amount", "billingInterval", "nextBillingDate", "dashboardUrl"],
	},
	"subscription-cancelled": {
		label: "Subscription Cancelled",
		variables: ["name", "appName", "planName", "endDate", "resubscribeUrl"],
	},
	"trial-ending": { label: "Trial Ending", variables: ["name", "appName", "trialEndDate", "daysLeft", "upgradeUrl"] },
	"team-invite": {
		label: "Team Invitation",
		variables: ["name", "inviterName", "teamName", "appName", "role", "inviteUrl", "expiresIn"],
	},
	alert: {
		label: "Alert",
		variables: ["name", "appName", "title", "message", "severity", "actionUrl", "actionLabel"],
	},
	digest: {
		label: "Digest",
		variables: ["name", "appName", "period", "highlight1", "highlight2", "highlight3", "dashboardUrl"],
	},
	announcement: {
		label: "Announcement",
		variables: ["name", "appName", "title", "version", "body", "ctaUrl", "ctaLabel"],
	},
	feedback: { label: "Feedback Request", variables: ["name", "appName", "surveyUrl", "context", "incentive"] },
	"account-deleted": { label: "Account Deleted", variables: ["name", "appName", "deletedAt", "supportUrl"] },
	plain: {
		label: "Plain Message",
		variables: ["name", "subject", "body", "ctaUrl", "ctaLabel", "appName", "footerNote"],
	},
	"verification-success": {
		label: "Verification Success",
		variables: ["name", "appName", "confirmationTime", "loginUrl"],
	},
	"subscription-confirmation": {
		label: "Subscription Confirmation",
		variables: [
			"name",
			"appName",
			"planName",
			"price",
			"billingCycle",
			"nextBillingDate",
			"subscriptionId",
			"invoiceUrl",
		],
	},
	"payment-failed": {
		label: "Payment Failed",
		variables: [
			"name",
			"appName",
			"planName",
			"amount",
			"failureReason",
			"gracePeriodEnd",
			"retryUrl",
			"updatePaymentUrl",
		],
	},
	"renewal-upcoming": {
		label: "Renewal Upcoming",
		variables: ["name", "appName", "planName", "amount", "billingDate", "viewInvoiceUrl"],
	},
	"subscription-resumed": {
		label: "Subscription Resumed",
		variables: ["name", "appName", "planName", "renewalDate", "amount", "dashboardUrl"],
	},
	"refund-approved": {
		label: "Refund Approved",
		variables: ["name", "appName", "refundAmount", "originalInvoiceId", "processedDate", "receiptUrl"],
	},
	"plan-upgraded": {
		label: "Plan Upgraded",
		variables: ["name", "appName", "oldPlanName", "newPlanName", "effectiveDate", "featuresGained", "dashboardUrl"],
	},
	"plan-downgraded": {
		label: "Plan Downgraded",
		variables: ["name", "appName", "oldPlanName", "newPlanName", "effectiveDate", "changeNote", "dashboardUrl"],
	},
	"oauth-linked": {
		label: "OAuth Linked",
		variables: ["name", "appName", "providerName", "linkedDate", "deviceInfo", "secureUrl"],
	},
	"database-created": {
		label: "Database Created",
		variables: ["name", "appName", "databaseName", "region", "connectionUrl", "docsUrl"],
	},
	"database-deleted": {
		label: "Database Deleted",
		variables: ["name", "appName", "databaseName", "deletionDate", "supportUrl"],
	},
	"usage-threshold": {
		label: "Usage Threshold Alert",
		variables: ["name", "appName", "usageType", "percentageUsed", "currentUsage", "quota", "upgradeUrl"],
	},
	"api-key-created": {
		label: "API Key Created",
		variables: ["name", "appName", "keyName", "createdDate", "keyPreview", "revokeUrl"],
	},
	"api-key-revoked": {
		label: "API Key Revoked",
		variables: ["name", "appName", "keyName", "revokedDate", "dashboardUrl"],
	},
	"plan-limit-reached": {
		label: "Plan Limit Reached",
		variables: ["name", "appName", "resourceType", "currentLimit", "planName", "upgradeUrl"],
	},
	"email-change-requested": {
		label: "Email Change Requested",
		variables: ["name", "appName", "oldEmail", "newEmail", "confirmUrl", "expiresIn"],
	},
	"email-change-confirmed": {
		label: "Email Change Confirmed",
		variables: ["name", "appName", "oldEmail", "newEmail", "changedAt", "supportUrl"],
	},
	"phone-verify": { label: "Phone Verification", variables: ["name", "appName", "code", "expiresIn"] },
	"account-locked": {
		label: "Account Locked",
		variables: ["name", "appName", "reason", "lockedUntil", "unlockUrl", "supportUrl"],
	},
	"account-unlocked": { label: "Account Unlocked", variables: ["name", "appName", "unlockedAt", "loginUrl"] },
	"backup-ready": {
		label: "Backup Ready",
		variables: ["name", "appName", "backupId", "createdAt", "expiresAt", "downloadUrl"],
	},
	"export-ready": {
		label: "Export Ready",
		variables: ["name", "appName", "exportType", "requestedAt", "expiresAt", "downloadUrl"],
	},
	"import-completed": {
		label: "Import Completed",
		variables: ["name", "appName", "importId", "recordsProcessed", "recordsFailed", "reportUrl"],
	},
	"maintenance-scheduled": {
		label: "Maintenance Scheduled",
		variables: ["name", "appName", "startTime", "endTime", "impactSummary", "statusPageUrl"],
	},
	"incident-update": {
		label: "Incident Update",
		variables: ["name", "appName", "incidentTitle", "status", "startedAt", "latestUpdate", "statusPageUrl"],
	},
	"feature-access-granted": {
		label: "Feature Access Granted",
		variables: ["name", "appName", "featureName", "enabledAt", "docsUrl", "dashboardUrl"],
	},
	"feature-access-revoked": {
		label: "Feature Access Revoked",
		variables: ["name", "appName", "featureName", "revokedAt", "reason", "supportUrl"],
	},
	"billing-receipt": {
		label: "Billing Receipt",
		variables: ["name", "appName", "receiptId", "amount", "paymentMethod", "paidAt", "receiptUrl"],
	},
	"payment-method-expiring": {
		label: "Payment Method Expiring",
		variables: ["name", "appName", "brand", "last4", "expiryMonth", "expiryYear", "updatePaymentUrl"],
	},
	"support-ticket-reply": {
		label: "Support Ticket Reply",
		variables: ["name", "appName", "ticketId", "agentName", "messageSnippet", "ticketUrl"],
	},
};

export async function renderLayout(
	layout: LayoutName,
	variables: Record<string, unknown>,
	themeId?: string,
): Promise<string> {
	const spec = LAYOUTS[layout];
	if (!spec) throw new Error(`Unknown layout: ${layout}`);
	const theme = THEMES[themeId ?? "default"] ?? THEMES["default"];
	return renderTemplateHtml(spec.label, spec.variables, variables, theme);
}

function renderTemplateHtml(
	label: string,
	fields: string[],
	variables: Record<string, unknown>,
	theme: EmailTheme,
): string {
	const value = (key: string) => {
		const raw = variables[key];
		if (raw == null || raw === "") return "";
		return escapeHtml(String(raw));
	};
	const name = value("name") || "there";
	const appName = value("appName") || "EmailFlare";
	const title = value("title") || value("subject") || label;
	const body =
		value("body") ||
		value("message") ||
		value("messageSnippet") ||
		value("latestUpdate") ||
		`Hi ${name}, this is a preview of the ${escapeHtml(label)} template from ${appName}.`;
	const actionUrl = firstValue(variables, [
		"loginUrl",
		"ctaUrl",
		"actionUrl",
		"magicUrl",
		"verifyUrl",
		"resetUrl",
		"supportUrl",
		"secureUrl",
		"trackingUrl",
		"payUrl",
		"dashboardUrl",
		"resubscribeUrl",
		"upgradeUrl",
		"inviteUrl",
		"surveyUrl",
		"invoiceUrl",
		"docsUrl",
		"downloadUrl",
		"reportUrl",
		"statusPageUrl",
		"receiptUrl",
		"updatePaymentUrl",
		"ticketUrl",
	]);
	const actionLabel = value("ctaLabel") || value("actionLabel") || (actionUrl ? "Open" : "");
	const code = value("code");
	const details = fields
		.filter(
			(field) =>
				!["name", "appName", "body", "message", "subject", "title", "ctaLabel", "actionLabel"].includes(field),
		)
		.map((field) => {
			const shown = value(field);
			return shown
				? `<tr><td style="padding:6px 12px 6px 0;color:${theme.muted};font-size:13px;">${escapeHtml(labelize(field))}</td><td style="padding:6px 0;color:${theme.strong};font-size:13px;">${shown}</td></tr>`
				: "";
		})
		.join("");

	return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:${theme.bodyBg};font-family:ui-sans-serif,system-ui,sans-serif;padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;background:${theme.surface};border:1px solid ${theme.border};border-radius:16px;padding:40px 32px;">
    <p style="margin:0 0 12px;color:${theme.primary};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(label)}</p>
    <h1 style="margin:0 0 16px;color:${theme.heading};font-size:24px;line-height:1.3;">${title}</h1>
    <p style="margin:0 0 8px;color:${theme.body};font-size:16px;line-height:1.6;">Hi ${name},</p>
    <p style="margin:0 0 20px;color:${theme.body};font-size:16px;line-height:1.6;white-space:pre-line;">${body}</p>
    ${code ? `<p style="margin:24px 0;text-align:center;font-family:ui-monospace,monospace;font-size:32px;font-weight:700;letter-spacing:.3em;color:${theme.primary};background:${theme.primarySubtle};border-radius:12px;padding:24px;">${code}</p>` : ""}
    ${actionUrl ? `<p style="margin:24px 0;"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:${theme.primary};color:${theme.primaryFg};text-decoration:none;font-weight:600;border-radius:8px;padding:12px 24px;">${actionLabel} →</a></p>` : ""}
    ${details ? `<table style="width:100%;border-top:1px solid ${theme.border};margin-top:24px;padding-top:12px;">${details}</table>` : ""}
    <p style="margin:28px 0 0;color:${theme.muted};font-size:13px;">Sent by ${appName}.</p>
  </div>
</body>
</html>`;
}

function firstValue(variables: Record<string, unknown>, keys: string[]): string {
	for (const key of keys) {
		const raw = variables[key];
		if (typeof raw === "string" && raw) return raw;
	}
	return "";
}

function labelize(key: string): string {
	return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function escapeHtml(value: string): string {
	return value.replace(/[&<>"']/g, (char) => {
		switch (char) {
			case "&":
				return "&" + "amp;";
			case "<":
				return "&" + "lt;";
			case ">":
				return "&" + "gt;";
			case '"':
				return "&" + "quot;";
			default:
				return "&" + "#39;";
		}
	});
}
