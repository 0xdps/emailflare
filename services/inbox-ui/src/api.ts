import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  withCredentials: true,
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const path = window.location.pathname;
    if (
      err.response?.status === 401 &&
      !path.startsWith('/login') &&
      !path.startsWith('/setup') &&
      !path.startsWith('/invite')
    ) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;

// ── Auth / Setup ──────────────────────────────────────────────────────────────

export async function getSetupStatus(): Promise<{ initialized: boolean }> {
  const { data } = await api.get('/api/setup/status');
  return data;
}

export async function setup(name: string, email: string, password: string): Promise<void> {
  await api.post('/api/setup', { name, email, password });
}

export async function login(email: string, password: string): Promise<void> {
  await api.post('/api/auth/login', { email, password });
}

export async function logout(): Promise<void> {
  await api.post('/api/auth/logout');
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super-admin' | 'admin' | 'member' | 'tester';
  created_at: string;
}

export async function me(): Promise<User> {
  const { data } = await api.get<User>('/api/auth/me');
  return data;
}

// ── Invites ───────────────────────────────────────────────────────────────────

export async function createInvite(email: string, role: 'admin' | 'member' | 'tester' = 'member'): Promise<{ inviteUrl: string }> {
  const { data } = await api.post('/api/admin/invites', { email, role });
  return data;
}

export async function getInvite(token: string): Promise<{ email: string }> {
  const { data } = await api.get(`/api/invites/${token}`);
  return data;
}

export async function acceptInvite(token: string, name: string, password: string): Promise<void> {
  await api.post(`/api/invites/${token}/accept`, { name, password });
}

// ── Users (admin) ─────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/api/admin/users');
  return data;
}

export async function revokeUser(id: string): Promise<void> {
  await api.delete(`/api/admin/users/${id}`);
}

export async function changeUserRole(id: string, role: 'admin' | 'member' | 'tester'): Promise<void> {
  await api.patch(`/api/admin/users/${id}/role`, { role });
}

// ── Domains ───────────────────────────────────────────────────────────────────

export interface Domain {
  id: string;
  name: string;
  verified: number;
  created_at: string;
}

export async function getDomains(): Promise<Domain[]> {
  const { data } = await api.get<Domain[]>('/api/domains');
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
}

export interface InboxEmail {
  id: string;
  type: 'received';
  person_id: string;
  inbox_address: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  message_id: string;
  spf: string | null;
  dkim: string | null;
  dmarc: string | null;
  is_read: number;
  received_at: string;
}

export interface SentEmail {
  id: string;
  type: 'sent';
  person_id: string;
  from_address: string;
  to_address: string;
  subject: string;
  status: string;
  sent_at: string;
}

export type ThreadItem = InboxEmail | SentEmail;

export interface Thread {
  person: Person;
  emails: ThreadItem[];
}

export interface Inbox {
  id: string;
  email: string;
  display_name: string;
  mode: 'thread' | 'chat';
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
  delayAfter: 'enrollment' | 'previous';
}

export interface InboxTemplate {
  id: string;
  slug: string;
  subject: string;
  body_html: string;
  created_at: string;
  updated_at: string;
}

// ── People ────────────────────────────────────────────────────────────────────

export async function getPeople(params?: {
  inbox?: string;
  search?: string;
  page?: number;
}): Promise<{ data: Person[]; total: number }> {
  const { data } = await api.get('/api/inbox/people', { params });
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
}): Promise<void> {
  await api.post('/api/inbox/send', params);
}

export async function replyTo(params: {
  personId: string;
  from: string;
  subject: string;
  text: string;
  replyToMessageId: string;
}): Promise<void> {
  await api.post('/api/inbox/send', { ...params, isReply: true });
}

// ── Inboxes ───────────────────────────────────────────────────────────────────

export async function getInboxes(): Promise<Inbox[]> {
  const { data } = await api.get<Inbox[]>('/api/inbox/inboxes');
  return data;
}

export async function createInbox(d: Pick<Inbox, 'email' | 'display_name' | 'mode'>): Promise<Inbox> {
  const { data } = await api.post<Inbox>('/api/inbox/inboxes', d);
  return data;
}

export async function updateInbox(id: string, d: Partial<Pick<Inbox, 'display_name' | 'mode'>>): Promise<Inbox> {
  const { data } = await api.put<Inbox>(`/api/inbox/inboxes/${id}`, d);
  return data;
}

export async function deleteInbox(id: string): Promise<void> {
  await api.delete(`/api/inbox/inboxes/${id}`);
}

export async function getInboxMembers(id: string): Promise<User[]> {
  const { data } = await api.get<User[]>(`/api/inbox/inboxes/${id}/members`);
  return data;
}

export async function addInboxMember(id: string, userId: string): Promise<void> {
  await api.post(`/api/inbox/inboxes/${id}/members`, { userId });
}

export async function removeInboxMember(id: string, userId: string): Promise<void> {
  await api.delete(`/api/inbox/inboxes/${id}/members/${userId}`);
}

// ── Sequences ─────────────────────────────────────────────────────────────────

export async function getSequences(): Promise<Sequence[]> {
  const { data } = await api.get<Sequence[]>('/api/inbox/sequences');
  return data;
}

export async function createSequence(d: Pick<Sequence, 'name' | 'steps'>): Promise<Sequence> {
  const { data } = await api.post<Sequence>('/api/inbox/sequences', d);
  return data;
}

export async function updateSequence(id: string, d: Partial<Pick<Sequence, 'name' | 'steps'>>): Promise<Sequence> {
  const { data } = await api.put<Sequence>(`/api/inbox/sequences/${id}`, d);
  return data;
}

export async function deleteSequence(id: string): Promise<void> {
  await api.delete(`/api/inbox/sequences/${id}`);
}

export async function enrollInSequence(sequenceId: string, personId: string, params: {
  fromAddress: string;
  variables?: Record<string, string>;
}): Promise<void> {
  await api.post(`/api/inbox/sequences/${sequenceId}/enroll`, { personId, ...params });
}

export async function cancelEnrollment(enrollmentId: string): Promise<void> {
  await api.delete(`/api/inbox/sequences/enrollments/${enrollmentId}`);
}

// ── Inbox Templates ───────────────────────────────────────────────────────────

export async function getInboxTemplates(): Promise<InboxTemplate[]> {
  const { data } = await api.get<InboxTemplate[]>('/api/inbox/inbox-templates');
  return data;
}

export async function createInboxTemplate(d: Pick<InboxTemplate, 'slug' | 'subject' | 'body_html'>): Promise<InboxTemplate> {
  const { data } = await api.post<InboxTemplate>('/api/inbox/inbox-templates', d);
  return data;
}

export async function updateInboxTemplate(id: string, d: Partial<Pick<InboxTemplate, 'slug' | 'subject' | 'body_html'>>): Promise<InboxTemplate> {
  const { data } = await api.put<InboxTemplate>(`/api/inbox/inbox-templates/${id}`, d);
  return data;
}

export async function deleteInboxTemplate(id: string): Promise<void> {
  await api.delete(`/api/inbox/inbox-templates/${id}`);
}
