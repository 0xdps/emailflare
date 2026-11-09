import axios from "axios";

const api = axios.create({
	baseURL: "/",
	withCredentials: true,
});

api.interceptors.response.use(
	(res) => res,
	(err) => {
		const path = window.location.pathname;
		if (
			err.response?.status === 401 &&
			!path.startsWith("/login") &&
			!path.startsWith("/setup") &&
			!path.startsWith("/invite") &&
			!path.startsWith("/forgot-password") &&
			!path.startsWith("/reset-password")
		) {
			window.location.href = "/login";
		}
		return Promise.reject(err);
	},
);

export default api;

// ── Auth / Setup ──────────────────────────────────────────────────────────────

export async function getSetupStatus(): Promise<{ initialized: boolean }> {
	const { data } = await api.get("/api/setup/status");
	return data;
}

export async function setup(name: string, email: string, password: string): Promise<void> {
	await api.post("/api/setup", { name, email, password });
}

export async function login(email: string, password: string): Promise<void> {
	await api.post("/api/auth/login", { email, password });
}

export async function forgotPassword(email: string): Promise<string> {
	const { data } = await api.post<{ message: string }>("/api/auth/forgot-password", { email });
	return data.message;
}

export async function resetPassword(token: string, password: string): Promise<void> {
	await api.post("/api/auth/reset-password", { token, password });
}

export async function logout(): Promise<void> {
	await api.post("/api/auth/logout");
}

export type UserType = "admin" | "member";
export type AccessType = "inbox" | "api" | "tester";

export interface User {
	id: string;
	name: string;
	email: string;
	user_type: UserType;
	access_types: AccessType[];
	created_at: string;
}

export async function me(): Promise<User> {
	const { data } = await api.get<User>("/api/auth/me");
	return data;
}

// ── Invites ───────────────────────────────────────────────────────────────────

export async function getInvite(token: string): Promise<{ email: string }> {
	const { data } = await api.get(`/api/invites/${token}`);
	return data;
}

export async function acceptInvite(token: string, name: string, password: string): Promise<void> {
	await api.post(`/api/invites/${token}/accept`, { name, password });
}

// ── Users (admin) ─────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
	const { data } = await api.get<User[]>("/api/admin/users");
	return data;
}

export async function updateUserPermissions(
	id: string,
	user_type: UserType,
	access_types: AccessType[],
): Promise<void> {
	await api.patch(`/api/admin/users/${id}/permissions`, { user_type, access_types });
}

// ── Domains ───────────────────────────────────────────────────────────────────

export interface Domain {
	id: string;
	name: string;
	verified: number;
	created_at: string;
}

export async function getDomains(): Promise<Domain[]> {
	const { data } = await api.get<Domain[]>("/api/domains");
	return data;
}

// ── Inbox types ───────────────────────────────────────────────────────────────

export interface Person {
	id: string;
	email: string;
	name: string | null;
	unread_count: number;
	total_count: number;
	last_email_at: string | null;
	latest_subject?: string | null;
	latest_snippet?: string | null;
	latest_inbox?: string | null;
	inbox_address?: string | null;
}

export interface ThreadItem {
	id: string;
	direction: "inbound" | "outbound";
	subject: string | null;
	body_html: string | null;
	body_text: string | null;
	body_r2_key: string | null;
	message_id: string | null;
	in_reply_to: string | null;
	references: string | null;
	thread_id: string | null;
	is_read: number;
	timestamp: string;
	inbox_address?: string | null;
	spf?: string | null;
	dkim?: string | null;
	dmarc?: string | null;
	attachments?: Array<{
		id: string;
		filename: string;
		content_type: string;
		size: number;
	}>;
}

export interface Thread {
	person: Person;
	thread: ThreadItem[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}

export interface InboxRouting {
	configured: boolean;
	error?: string;
}

export interface Inbox {
	id: string;
	email: string;
	display_name: string;
	mode: "thread" | "individual";
	routing?: InboxRouting;
}

export interface Sequence {
	id: string;
	name: string;
	steps: SequenceStep[];
	created_at: string;
}

export interface SequenceStep {
	templateSlug: string;
	delayDays: number;
	delayAfter: "enrollment" | "previous";
}

export interface InboxTemplate {
	id: string;
	slug: string;
	subject: string;
	body_html: string;
	created_at: string;
	updated_at: string;
}

export interface ThreadSummary {
	id: string; // thread_id
	thread_id: string;
	inbox_address: string;
	counterparty_email: string;
	counterparty_name: string | null;
	person_id?: string | null;
	subject: string;
	latest_snippet?: string | null;
	last_message_at: string;
	unread_count: number;
	total_count: number;
}

export async function getThreads(params?: {
	inbox?: string;
	search?: string;
	unread?: boolean;
	page?: number;
}): Promise<{ data: ThreadSummary[]; total: number }> {
	const { data } = await api.get("/api/inbox/threads", {
		params: {
			...params,
			unread: params?.unread ? "1" : undefined,
		},
	});
	return data;
}

export async function getThreadDetails(threadId: string): Promise<Thread> {
	const { data } = await api.get<Thread>(`/api/inbox/threads/${threadId}`);
	return data;
}

export async function markThreadRead(threadId: string): Promise<void> {
	await api.post(`/api/inbox/threads/${threadId}/mark-read`);
}

// ── People ────────────────────────────────────────────────────────────────────

export async function getPeople(params?: {
	inbox?: string;
	search?: string;
	page?: number;
}): Promise<{ data: Person[]; total: number }> {
	const { data } = await api.get("/api/inbox/people", { params });
	return data;
}

export async function getThread(personId: string): Promise<Thread> {
	const { data } = await api.get<Thread>(`/api/inbox/people/${personId}/thread`);
	return data;
}

export async function markRead(personId: string): Promise<void> {
	await api.post(`/api/inbox/people/${personId}/mark-read`);
}

// ── Compose / Reply ───────────────────────────────────────────────────────────

export async function composeSend(params: {
	from: string;
	to: string;
	subject: string;
	text: string;
	personId?: string;
}): Promise<{ ok: boolean; id: string; threadId: string; personId?: string }> {
	const { data } = await api.post("/api/inbox/compose", params);
	return data;
}

export async function replyTo(params: {
	personId: string;
	to: string;
	from: string;
	subject: string;
	text: string;
	replyToMessageId: string;
	references?: string;
}): Promise<void> {
	await api.post("/api/inbox/compose", {
		to: params.to,
		from: params.from,
		subject: params.subject,
		text: params.text,
		inReplyTo: params.replyToMessageId,
		references: params.references,
		personId: params.personId,
	});
}

// ── Inboxes ───────────────────────────────────────────────────────────────────

export async function getInboxes(): Promise<Inbox[]> {
	const { data } = await api.get<Inbox[]>("/api/inbox/inboxes");
	return data;
}

export async function getInboxMembers(id: string): Promise<User[]> {
	const { data } = await api.get<User[]>(`/api/inbox/inboxes/${id}/members`);
	return data;
}

// ── Sequences ─────────────────────────────────────────────────────────────────

export async function getSequences(): Promise<Sequence[]> {
	const { data } = await api.get<Sequence[]>("/api/inbox/sequences");
	return data;
}

export async function enrollInSequence(
	sequenceId: string,
	personId: string,
	params: {
		fromAddress: string;
		variables?: Record<string, string>;
	},
): Promise<void> {
	await api.post(`/api/inbox/sequences/${sequenceId}/enroll`, { personId, ...params });
}

export async function cancelEnrollment(enrollmentId: string): Promise<void> {
	await api.delete(`/api/inbox/sequences/enrollments/${enrollmentId}`);
}

// ── Inbox Templates ───────────────────────────────────────────────────────────

export async function getInboxTemplates(): Promise<InboxTemplate[]> {
	const { data } = await api.get<InboxTemplate[]>("/api/inbox/inbox-templates");
	return data;
}

export async function createInboxTemplate(
	d: Pick<InboxTemplate, "slug" | "subject" | "body_html">,
): Promise<InboxTemplate> {
	const { data } = await api.post<InboxTemplate>("/api/inbox/inbox-templates", d);
	return data;
}

export async function updateInboxTemplate(
	id: string,
	d: Partial<Pick<InboxTemplate, "slug" | "subject" | "body_html">>,
): Promise<InboxTemplate> {
	const { data } = await api.put<InboxTemplate>(`/api/inbox/inbox-templates/${id}`, d);
	return data;
}

export async function deleteInboxTemplate(id: string): Promise<void> {
	await api.delete(`/api/inbox/inbox-templates/${id}`);
}

// ── Test Emails (Sandbox) ─────────────────────────────────────────────────────

export interface TestEmailRow {
	id: string;
	to_address: string;
	from_address: string;
	subject: string;
	status: "sent" | "failed";
	cf_message_id: string | null;
	domain_id: string | null;
	template_id: string | null;
	error: string | null;
	is_test: number;
	html_body: string | null;
	text_body: string | null;
	sent_at: string;
}

export async function getTestEmails(params?: { search?: string; limit?: number; page?: number }): Promise<{
	data: TestEmailRow[];
	total: number;
	page: number;
	limit: number;
	pages: number;
}> {
	const { data } = await api.get("/api/test-emails", { params });
	return data;
}

export async function deleteTestEmail(id: string): Promise<void> {
	await api.delete(`/api/test-emails/${id}`);
}

export async function clearAllTestEmails(): Promise<void> {
	await api.delete("/api/test-emails");
}

// ── Playground ────────────────────────────────────────────────────────────────

export interface PlaygroundSendInput {
	from: string;
	fromName?: string;
	to: string;
	subject?: string;
	templateId?: string;
	templateSlug?: string;
	variables?: Record<string, unknown>;
	themeId?: string;
	mode: "test" | "live";
	apiKey?: string;
}

export async function sendPlaygroundEmail(
	input: PlaygroundSendInput,
): Promise<{ ok: boolean; isTest?: boolean; messageId?: string; error?: string }> {
	const { data } = await api.post("/api/playground/send", input);
	return data;
}
