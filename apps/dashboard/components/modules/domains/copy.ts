// Wording and defaults shared by every place a domain can be enabled (the Domains page and
// first-run setup), so both say the same thing and propose the same name.

export const SENDING_SUBDOMAIN_PREFIX = "mail";

export const SENDING_NAME_HELP =
	"Sending from a subdomain such as mail.example.com keeps your sending reputation separate from your main domain and leaves its existing email untouched.";

export const ENABLE_EXPLAINER =
	"Enabling a domain adds sending DNS records (SPF, DKIM and a return path) and points the zone's Email Routing catch-all at this Worker so mailboxes on it can receive mail.";

export const RECEIVING_WARNING =
	"If this domain already receives mail somewhere else (for example Google Workspace), enabling it replaces the Email Routing catch-all rule.";

export const REMOVE_DOMAIN_NOTE =
	"This only removes the domain from EmailFlare. The sending subdomain, DNS records and Email Routing rule stay in Cloudflare until you delete them there. API keys restricted to this domain will no longer be able to send.";

export function defaultSendingName(zoneName: string, useSubdomain = true): string {
	return useSubdomain ? `${SENDING_SUBDOMAIN_PREFIX}.${zoneName}` : zoneName;
}
