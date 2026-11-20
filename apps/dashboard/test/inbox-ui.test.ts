import assert from "node:assert/strict";
import test from "node:test";
import { parseThreadView, threadViewCondition } from "../lib/core/thread-views.ts";
import { dateBucket, previewText } from "../lib/inbox/format.ts";
import { allNavItems, goShortcuts, isNavActive, workspaceForPath } from "../lib/nav/config.ts";

test("parseThreadView falls back to the legacy unread flag, then to inbox", () => {
	assert.equal(parseThreadView("starred"), "starred");
	assert.equal(parseThreadView("bogus"), "inbox");
	assert.equal(parseThreadView(undefined, true), "unread");
	assert.equal(parseThreadView("archived", true), "archived");
});

test("only the archived view selects archived threads", () => {
	assert.match(threadViewCondition("archived"), /^m\.thread_id IN/);
	assert.match(threadViewCondition("inbox"), /NOT IN/);
	assert.match(threadViewCondition("unread"), /NOT IN/);
	assert.match(threadViewCondition("starred"), /is_starred = 1/);
});

test("dateBucket groups by calendar day, not by 24h windows", () => {
	const now = new Date(2026, 10, 20, 0, 30);
	assert.equal(dateBucket(new Date(2026, 10, 20, 0, 5).toISOString(), now), "Today");
	assert.equal(dateBucket(new Date(2026, 10, 19, 23, 50).toISOString(), now), "Yesterday");
	assert.equal(dateBucket(new Date(2026, 10, 16, 12).toISOString(), now), "This week");
	assert.equal(dateBucket(new Date(2026, 10, 1, 12).toISOString(), now), "Earlier");
});

test("previewText drops quoted history and collapses whitespace", () => {
	assert.equal(previewText("Looks good.\n\nOn Mon, Ada wrote:\n> please review"), "Looks good.");
	assert.equal(previewText("a\n\n  b"), "a b");
	assert.equal(previewText("x".repeat(200), 10), `${"x".repeat(10)}…`);
});

test("inbox view links only light up for their own view, regardless of mailbox", () => {
	const inbox = allNavItems().find((i) => i.title === "Inbox")!;
	const starred = allNavItems().find((i) => i.title === "Starred")!;
	const at = (path: string, query = "") => ({ pathname: path, params: new URLSearchParams(query) });

	assert.equal(isNavActive(inbox, at("/inbox")), true);
	assert.equal(isNavActive(inbox, at("/inbox", "view=unread")), true);
	assert.equal(isNavActive(inbox, at("/inbox", "view=starred")), false);
	assert.equal(isNavActive(inbox, at("/inbox", "mailbox=a@b.c")), true);
	assert.equal(isNavActive(starred, at("/inbox", "view=starred&mailbox=a@b.c")), true);
	assert.equal(isNavActive(inbox, at("/inbox", "folder=test")), false);
	assert.equal(isNavActive(starred, at("/inbox", "view=starred")), true);
});

test("workspaces resolve from the path and go-shortcuts are unique", () => {
	assert.equal(workspaceForPath("/inbox/settings"), "admin");
	assert.equal(workspaceForPath("/inbox/people"), "inbox");
	assert.equal(workspaceForPath("/developer/logs"), "api");

	const keys = allNavItems().flatMap((i) => (i.go ? [i.go] : []));
	assert.equal(new Set(keys).size, keys.length);
	assert.equal(goShortcuts()["i"], "/inbox");
});
