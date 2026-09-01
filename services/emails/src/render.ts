import { render } from "@react-email/render";
import { THEMES, themeToTailwindConfig } from "./themes.js";
import { runWithTheme } from "./ThemeContext.js";
import { Welcome } from "./layouts/Welcome.js";
import { MagicLink } from "./layouts/MagicLink.js";
import { Notification } from "./layouts/Notification.js";
import { OTP } from "./layouts/OTP.js";
import { EmailVerify } from "./layouts/EmailVerify.js";
import { PasswordReset } from "./layouts/PasswordReset.js";
import { PasswordChanged } from "./layouts/PasswordChanged.js";
import { NewLogin } from "./layouts/NewLogin.js";
import { OrderConfirm } from "./layouts/OrderConfirm.js";
import { Invoice } from "./layouts/Invoice.js";
import { SubscriptionStarted } from "./layouts/SubscriptionStarted.js";
import { SubscriptionCancelled } from "./layouts/SubscriptionCancelled.js";
import { TrialEnding } from "./layouts/TrialEnding.js";
import { TeamInvite } from "./layouts/TeamInvite.js";
import { Alert } from "./layouts/Alert.js";
import { Digest } from "./layouts/Digest.js";
import { Announcement } from "./layouts/Announcement.js";
import { Feedback } from "./layouts/Feedback.js";
import { AccountDeleted } from "./layouts/AccountDeleted.js";
import { Plain } from "./layouts/Plain.js";
import { VerificationSuccess } from "./layouts/VerificationSuccess.js";
import { SubscriptionConfirmation } from "./layouts/SubscriptionConfirmation.js";
import { PaymentFailed } from "./layouts/PaymentFailed.js";
import { RenewalUpcoming } from "./layouts/RenewalUpcoming.js";
import { SubscriptionResumed } from "./layouts/SubscriptionResumed.js";
import { RefundApproved } from "./layouts/RefundApproved.js";
import { PlanUpgraded } from "./layouts/PlanUpgraded.js";
import { PlanDowngraded } from "./layouts/PlanDowngraded.js";
import { OAuthLinked } from "./layouts/OAuthLinked.js";
import { DatabaseCreated } from "./layouts/DatabaseCreated.js";
import { DatabaseDeleted } from "./layouts/DatabaseDeleted.js";
import { UsageThreshold } from "./layouts/UsageThreshold.js";
import { ApiKeyCreated } from "./layouts/ApiKeyCreated.js";
import { ApiKeyRevoked } from "./layouts/ApiKeyRevoked.js";
import { PlanLimitReached } from "./layouts/PlanLimitReached.js";
import { EmailChangeRequested } from "./layouts/EmailChangeRequested.js";
import { EmailChangeConfirmed } from "./layouts/EmailChangeConfirmed.js";
import { PhoneVerify } from "./layouts/PhoneVerify.js";
import { AccountLocked } from "./layouts/AccountLocked.js";
import { AccountUnlocked } from "./layouts/AccountUnlocked.js";
import { BackupReady } from "./layouts/BackupReady.js";
import { ExportReady } from "./layouts/ExportReady.js";
import { ImportCompleted } from "./layouts/ImportCompleted.js";
import { MaintenanceScheduled } from "./layouts/MaintenanceScheduled.js";
import { IncidentUpdate } from "./layouts/IncidentUpdate.js";
import { FeatureAccessGranted } from "./layouts/FeatureAccessGranted.js";
import { FeatureAccessRevoked } from "./layouts/FeatureAccessRevoked.js";
import { BillingReceipt } from "./layouts/BillingReceipt.js";
import { PaymentMethodExpiring } from "./layouts/PaymentMethodExpiring.js";
import { SupportTicketReply } from "./layouts/SupportTicketReply.js";
import React from "react";

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
	const theme = THEMES[themeId ?? "default"] ?? THEMES["default"];
	const tailwindConfig = themeToTailwindConfig(theme);
	const components: Record<LayoutName, React.FC<Record<string, string>>> = {
		welcome: Welcome as React.FC<Record<string, string>>,
		"magic-link": MagicLink as React.FC<Record<string, string>>,
		notification: Notification as React.FC<Record<string, string>>,
		otp: OTP as React.FC<Record<string, string>>,
		"email-verify": EmailVerify as React.FC<Record<string, string>>,
		"password-reset": PasswordReset as React.FC<Record<string, string>>,
		"password-changed": PasswordChanged as React.FC<Record<string, string>>,
		"new-login": NewLogin as React.FC<Record<string, string>>,
		"order-confirm": OrderConfirm as React.FC<Record<string, string>>,
		invoice: Invoice as React.FC<Record<string, string>>,
		"subscription-started": SubscriptionStarted as React.FC<Record<string, string>>,
		"subscription-cancelled": SubscriptionCancelled as React.FC<Record<string, string>>,
		"trial-ending": TrialEnding as React.FC<Record<string, string>>,
		"team-invite": TeamInvite as React.FC<Record<string, string>>,
		alert: Alert as React.FC<Record<string, string>>,
		digest: Digest as React.FC<Record<string, string>>,
		announcement: Announcement as React.FC<Record<string, string>>,
		feedback: Feedback as React.FC<Record<string, string>>,
		"account-deleted": AccountDeleted as React.FC<Record<string, string>>,
		plain: Plain as React.FC<Record<string, string>>,
		"verification-success": VerificationSuccess as React.FC<Record<string, string>>,
		"subscription-confirmation": SubscriptionConfirmation as React.FC<Record<string, string>>,
		"payment-failed": PaymentFailed as React.FC<Record<string, string>>,
		"renewal-upcoming": RenewalUpcoming as React.FC<Record<string, string>>,
		"subscription-resumed": SubscriptionResumed as React.FC<Record<string, string>>,
		"refund-approved": RefundApproved as React.FC<Record<string, string>>,
		"plan-upgraded": PlanUpgraded as React.FC<Record<string, string>>,
		"plan-downgraded": PlanDowngraded as React.FC<Record<string, string>>,
		"oauth-linked": OAuthLinked as React.FC<Record<string, string>>,
		"database-created": DatabaseCreated as React.FC<Record<string, string>>,
		"database-deleted": DatabaseDeleted as React.FC<Record<string, string>>,
		"usage-threshold": UsageThreshold as React.FC<Record<string, string>>,
		"api-key-created": ApiKeyCreated as React.FC<Record<string, string>>,
		"api-key-revoked": ApiKeyRevoked as React.FC<Record<string, string>>,
		"plan-limit-reached": PlanLimitReached as React.FC<Record<string, string>>,
		"email-change-requested": EmailChangeRequested as React.FC<Record<string, string>>,
		"email-change-confirmed": EmailChangeConfirmed as React.FC<Record<string, string>>,
		"phone-verify": PhoneVerify as React.FC<Record<string, string>>,
		"account-locked": AccountLocked as React.FC<Record<string, string>>,
		"account-unlocked": AccountUnlocked as React.FC<Record<string, string>>,
		"backup-ready": BackupReady as React.FC<Record<string, string>>,
		"export-ready": ExportReady as React.FC<Record<string, string>>,
		"import-completed": ImportCompleted as React.FC<Record<string, string>>,
		"maintenance-scheduled": MaintenanceScheduled as React.FC<Record<string, string>>,
		"incident-update": IncidentUpdate as React.FC<Record<string, string>>,
		"feature-access-granted": FeatureAccessGranted as React.FC<Record<string, string>>,
		"feature-access-revoked": FeatureAccessRevoked as React.FC<Record<string, string>>,
		"billing-receipt": BillingReceipt as React.FC<Record<string, string>>,
		"payment-method-expiring": PaymentMethodExpiring as React.FC<Record<string, string>>,
		"support-ticket-reply": SupportTicketReply as React.FC<Record<string, string>>,
	};

	const Component = components[layout];
	if (!Component) throw new Error(`Unknown layout: ${layout}`);

	return runWithTheme(tailwindConfig, () =>
		render(React.createElement(Component, variables as Record<string, string>)),
	);
}
