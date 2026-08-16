import React, { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Plus, Trash2, Pencil, Loader2, Inbox, Users, Globe, AlertTriangle, Check } from 'lucide-react';
import {
  getInboxes, createInbox, updateInbox, deleteInbox, setupInboxRouting,
  getInboxMembers, addInboxMember, removeInboxMember,
  getDomains,
  Inbox as InboxType, Domain as DomainType, User, getUsers,
} from '../../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InboxSettings() {
  const [inboxes, setInboxes] = useState<InboxType[]>([]);
  const [domains, setDomains] = useState<DomainType[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [createdInbox, setCreatedInbox] = useState<InboxType | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InboxType | null>(null);
  const [localPart, setLocalPart] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'thread' | 'individual'>('thread');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [routingId, setRoutingId] = useState<string | null>(null);

  // Step 3 — user assignment
  const [assignUsers, setAssignUsers] = useState<User[]>([]);
  const [assignMembers, setAssignMembers] = useState<User[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignAdding, setAssignAdding] = useState(false);

  // Members sheet
  const [membersInbox, setMembersInbox] = useState<InboxType | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [addUserId, setAddUserId] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    Promise.all([getInboxes(), getDomains()]).then(([inboxList, domainList]) => {
      setInboxes(inboxList);
      setDomains(domainList);
    }).finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setLocalPart('');
    setSelectedDomain(domains[0]?.name ?? '');
    setDisplayName('');
    setMode('thread');
    setCreateStep(1);
    setCreatedInbox(null);
    setAssignUsers([]);
    setAssignMembers([]);
    setAssignUserId('');
    setCreateOpen(true);
  }

  function openEdit(inbox: InboxType) {
    setEditing(inbox);
    setDisplayName(inbox.display_name);
    setMode(inbox.mode);
  }

  // Step 1 → create the inbox (backend also attempts routing auto-config)
  async function handleCreateInbox() {
    setCreating(true);
    try {
      const created = await createInbox({ email: `${localPart.trim()}@${selectedDomain}`, display_name: displayName, mode });
      setCreatedInbox(created);
      setInboxes(prev => [...prev, created]);
      setCreateStep(2);
    } finally {
      setCreating(false);
    }
  }

  // Step 2 → retry routing if it failed
  async function handleRetryRouting() {
    if (!createdInbox) return;
    setRoutingId(createdInbox.id);
    try {
      const result = await setupInboxRouting(createdInbox.id);
      const updated = { ...createdInbox, routing: result.routing };
      setCreatedInbox(updated);
      setInboxes(prev => prev.map(i => i.id === createdInbox.id ? updated : i));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Routing setup failed';
      const updated = { ...createdInbox, routing: { configured: false, error: msg } };
      setCreatedInbox(updated);
      setInboxes(prev => prev.map(i => i.id === createdInbox.id ? updated : i));
    } finally {
      setRoutingId(null);
    }
  }

  // Step 2 → advance to user assignment (load all users)
  async function goToAssign() {
    setCreateStep(3);
    setAssignUserId('');
    try {
      setAssignUsers(await getUsers());
    } catch { /* leave empty */ }
  }

  async function handleAssignMember() {
    if (!createdInbox || !assignUserId) return;
    setAssignAdding(true);
    try {
      await addInboxMember(createdInbox.id, assignUserId);
      const user = assignUsers.find(u => u.id === assignUserId);
      if (user) setAssignMembers(prev => [...prev, user]);
      setAssignUserId('');
    } finally {
      setAssignAdding(false);
    }
  }

  function finishCreate() {
    setCreateOpen(false);
    setCreatedInbox(null);
    setCreateStep(1);
  }

  async function handleEditSave() {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await updateInbox(editing.id, { display_name: displayName, mode });
      setInboxes(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteInbox(deleteId);
      setInboxes(prev => prev.filter(i => i.id !== deleteId));
      setDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSetupRouting(inbox: InboxType) {
    setRoutingId(inbox.id);
    try {
      const result = await setupInboxRouting(inbox.id);
      setInboxes(prev => prev.map(i => i.id === inbox.id ? { ...i, routing: result.routing } : i));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Routing setup failed';
      setInboxes(prev => prev.map(i => i.id === inbox.id ? { ...i, routing: { configured: false, error: msg } } : i));
    } finally {
      setRoutingId(null);
    }
  }

  async function openMembers(inbox: InboxType) {
    setMembersInbox(inbox);
    setAddUserId('');
    setLoadingMembers(true);
    try {
      const [m, users] = await Promise.all([getInboxMembers(inbox.id), getUsers()]);
      setMembers(m);
      setAllUsers(users);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleAddMember() {
    if (!membersInbox || !addUserId) return;
    setAddingMember(true);
    try {
      await addInboxMember(membersInbox.id, addUserId);
      const updated = await getInboxMembers(membersInbox.id);
      setMembers(updated);
      setAddUserId('');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!membersInbox) return;
    await removeInboxMember(membersInbox.id, userId).catch(() => {});
    setMembers(prev => prev.filter(m => m.id !== userId));
  }

  const nonMembers = allUsers.filter(u => !members.some(m => m.id === u.id));

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-semibold text-foreground tracking-tight">Inboxes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage receiving addresses and team members</p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={domains.length === 0}>
          <Plus size={14} />
          New inbox
        </Button>
      </div>

      {!loading && domains.length === 0 && (
        <div className="mb-4 flex items-center gap-2.5 px-3.5 py-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <AlertTriangle size={14} className="shrink-0 text-amber-500" />
          <span className="flex-1">No domains configured — you need a domain before creating an inbox.</span>
          <Link to="/domains" className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline-offset-2 hover:underline whitespace-nowrap">
            Set up a domain →
          </Link>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
      ) : inboxes.length === 0 ? (
        domains.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <Globe size={36} className="opacity-20" />
            <p className="text-sm font-medium text-foreground/70">No domains configured</p>
            <p className="text-xs text-center max-w-xs text-muted-foreground/70">
              Add a domain to your account first — the inbox email address must belong to a domain in your system.
            </p>
            <Link to="/domains">
              <Button size="sm" variant="outline">Set up a domain →</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
            <Inbox size={36} className="opacity-20" />
            <p className="text-sm">No inboxes configured yet</p>
            <Button size="sm" variant="outline" onClick={openCreate}>Create your first inbox</Button>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email address</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Routing</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inboxes.map(inbox => (
                <TableRow key={inbox.id}>
                  <TableCell className="font-mono text-sm">{inbox.email}</TableCell>
                  <TableCell className="text-sm">{inbox.display_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{inbox.mode}</Badge>
                  </TableCell>
                  <TableCell>
                    {inbox.routing?.configured ? (
                      <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                        Active
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 gap-1.5 text-xs"
                          disabled={routingId === inbox.id}
                          onClick={() => handleSetupRouting(inbox)}
                        >
                          {routingId === inbox.id && <Loader2 size={12} className="animate-spin" />}
                          Setup routing
                        </Button>
                        {inbox.routing?.error && (
                          <span className="text-[11px] text-amber-600" title={inbox.routing.error}>
                            <AlertTriangle size={12} className="inline" />
                          </span>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openMembers(inbox)} className="h-7 px-2 gap-1.5 text-xs">
                        <Users size={12} />
                        Members
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(inbox)} className="h-7 px-2">
                        <Pencil size={12} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteId(inbox.id)} className="h-7 px-2 hover:text-destructive">
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ── Create wizard: 1 Inbox → 2 Routing → 3 Members ── */}
      <Dialog open={createOpen} onOpenChange={open => { if (!open) finishCreate(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New inbox</DialogTitle>
            <div className="flex items-center gap-1 pt-1">
              {([1, 2, 3] as const).map(step => (
                <div key={step} className="flex items-center gap-1">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                      createStep > step ? 'bg-emerald-500 text-white' : createStep === step ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {createStep > step ? <Check size={11} /> : step}
                  </span>
                  {step < 3 && <span className={`h-px w-4 ${createStep > step ? 'bg-emerald-500' : 'bg-muted'}`} />}
                </div>
              ))}
            </div>
          </DialogHeader>

          {/* Step 1 — Inbox details */}
          {createStep === 1 && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label>Email address</Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    className="flex-1"
                    placeholder="support"
                    value={localPart}
                    onChange={e => setLocalPart(e.target.value.replace(/[@\s]/g, ''))}
                    autoFocus
                  />
                  <span className="text-sm text-muted-foreground select-none">@</span>
                  <Select value={selectedDomain} onValueChange={v => setSelectedDomain(v ?? '')}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map(d => (
                        <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-muted-foreground">Must be configured in Cloudflare Email Routing</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Display name</Label>
                <Input placeholder="Support" value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={v => setMode(v as 'thread' | 'individual')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="thread">Thread</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2 — Routing result */}
          {createStep === 2 && createdInbox && (
            <div className="flex flex-col gap-4 py-2">
              {createdInbox.routing?.configured ? (
                <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
                  <Check size={15} className="shrink-0 text-emerald-500" />
                  <span>Email Routing is configured — inbound mail will be delivered to this inbox.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
                  <div className="flex items-center gap-2.5 text-sm text-amber-800">
                    <AlertTriangle size={15} className="shrink-0 text-amber-500" />
                    <span>Email Routing couldn't be configured automatically.</span>
                  </div>
                  {createdInbox.routing?.error && (
                    <p className="text-[12px] text-amber-700 break-words">{createdInbox.routing.error}</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    disabled={routingId === createdInbox.id}
                    onClick={handleRetryRouting}
                  >
                    {routingId === createdInbox.id && <Loader2 size={12} className="animate-spin" />}
                    Retry setup
                  </Button>
                </div>
              )}
              <p className="text-[12px] text-muted-foreground">
                You can also configure routing later from the inbox list.
              </p>
            </div>
          )}

          {/* Step 3 — User assignment */}
          {createStep === 3 && createdInbox && (
            <div className="flex flex-col gap-4 py-2">
              <p className="text-sm text-muted-foreground">Assign team members who can access <span className="font-mono text-foreground">{createdInbox.email}</span>.</p>

              {assignMembers.length > 0 && (
                <div className="flex flex-col gap-1">
                  {assignMembers.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{u.name}</p>
                        <p className="text-[11.5px] text-muted-foreground">{u.email}</p>
                      </div>
                      <button
                        onClick={() => setAssignMembers(prev => prev.filter(m => m.id !== u.id))}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {assignUsers.filter(u => !assignMembers.some(m => m.id === u.id)).length === 0 ? (
                <p className="text-xs text-muted-foreground">All users are already members</p>
              ) : (
                <div className="flex gap-2">
                  <Select value={assignUserId} onValueChange={v => setAssignUserId(v ?? '')}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select user…" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignUsers.filter(u => !assignMembers.some(m => m.id === u.id)).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleAssignMember} disabled={!assignUserId || assignAdding}>
                    {assignAdding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    Add
                  </Button>
                </div>
              )}

              <p className="text-[12px] text-muted-foreground">You can add or remove members later from the inbox list.</p>
            </div>
          )}

          <DialogFooter>
            {createStep > 1 && (
              <Button variant="outline" onClick={() => setCreateStep(prev => (prev - 1) as 1 | 2 | 3)} disabled={creating || routingId === createdInbox?.id}>
                Back
              </Button>
            )}
            {createStep === 1 && (
              <Button onClick={handleCreateInbox} disabled={creating || !localPart.trim() || !selectedDomain || !displayName.trim()}>
                {creating && <Loader2 size={13} className="animate-spin" />}
                {creating ? 'Creating…' : 'Create'}
              </Button>
            )}
            {createStep === 2 && (
              <Button onClick={goToAssign} disabled={routingId === createdInbox?.id}>
                Continue
              </Button>
            )}
            {createStep === 3 && (
              <Button onClick={finishCreate}>Finish</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit inbox</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label>Display name</Label>
              <Input
                placeholder="Support"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mode</Label>
              <Select value={mode} onValueChange={v => setMode(v as 'thread' | 'individual')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thread">Thread</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving || !displayName.trim()}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members Sheet */}
      <Sheet open={!!membersInbox} onOpenChange={open => !open && setMembersInbox(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px] px-6">
          <SheetHeader>
            <SheetTitle>Members — {membersInbox?.display_name}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4 py-5">
            {loadingMembers ? (
              <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                {/* Current members */}
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No members assigned yet</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {members.map(u => (
                      <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50">
                        <div>
                          <p className="text-[13px] font-medium text-foreground">{u.name}</p>
                          <p className="text-[11.5px] text-muted-foreground">{u.email}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(u.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Add member */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Add member</Label>
                  {nonMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">All users are already members</p>
                  ) : (
                    <div className="flex gap-2">
                      <Select value={addUserId} onValueChange={(v) => setAddUserId(v ?? '')}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select user…" />
                        </SelectTrigger>
                        <SelectContent>
                          {nonMembers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleAddMember} disabled={!addUserId || addingMember}>
                        {addingMember ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete inbox?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">All associated emails and threads will be permanently deleted. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 size={13} className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
