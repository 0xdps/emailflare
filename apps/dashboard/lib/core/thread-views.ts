export const THREAD_VIEWS = ["inbox", "unread", "starred", "archived"] as const;
export type ThreadView = (typeof THREAD_VIEWS)[number];

export function parseThreadView(raw: string | null | undefined, unreadFlag = false): ThreadView {
	if (raw && (THREAD_VIEWS as readonly string[]).includes(raw)) return raw as ThreadView;
	return unreadFlag ? "unread" : "inbox";
}

// SQL fragment over the `all_messages` CTE (alias `m`) restricting threads to a view.
export function threadViewCondition(view: ThreadView): string {
	const archived = "SELECT thread_id FROM thread_state WHERE is_archived = 1";
	switch (view) {
		case "archived":
			return `m.thread_id IN (${archived})`;
		case "starred":
			return "m.thread_id IN (SELECT thread_id FROM thread_state WHERE is_starred = 1)";
		case "inbox":
		case "unread":
			return `m.thread_id NOT IN (${archived})`;
	}
}
