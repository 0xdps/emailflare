// Parses a raw RFC 822 message, then classifies DSN/ARF content.
// Classification lives in @emailflare/email-core so the Worker handler shares it.

import PostalMime from "postal-mime";

export {
	isBounce,
	isComplaint,
	extractRecipient,
	classifyBounce,
	extractReason,
	type BounceMessageView,
	type BounceClass,
} from "@emailflare/email-core";

type ParsedEmail = Awaited<ReturnType<PostalMime["parse"]>>;

export async function parseEmail(raw: ArrayBuffer): Promise<ParsedEmail> {
	return new PostalMime().parse(raw);
}
