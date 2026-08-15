import React, { useEffect, useState } from 'react';
import { Plus, Loader2, Users, Trash2, Copy, Check } from 'lucide-react';
import { getUsers, createInvite, revokeUser, changeUserRole, me, User } from '../../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

function RoleBadge({ role }: { role: User['role'] }) {
  if (role === 'super-admin') {
    return (
      <Badge className="text-[10px] h-4 px-1.5 bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-50">
        owner
      </Badge>
    );
  }
  if (role === 'admin') {
    return (
      <Badge className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50">
        admin
      </Badge>
    );
  }
  if (role === 'tester') {
    return (
      <Badge className="text-[10px] h-4 px-1.5 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-50">
        tester
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
      user
    </Badge>
  );
}

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'tester'>('member');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [changingRoleId, setChangingRoleId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([me(), getUsers()])
      .then(([u, list]) => { setCurrentUser(u); setUsers(list); })
      .finally(() => setLoading(false));
  }, []);

  async function handleInvite() {
    setInviteError('');
    setInviting(true);
    try {
      const { inviteUrl: url } = await createInvite(inviteEmail.trim(), inviteRole);
      setInviteUrl(url);
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      if (msg === 'already_exists') setInviteError('A user with that email already exists.');
      else setInviteError('Failed to create invite. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  function closeInviteDialog() {
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('member');
    setInviteUrl('');
    setInviteError('');
    setCopied(false);
  }

  async function copyInviteUrl() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRevoke() {
    if (!revokeId) return;
    setRevoking(true);
    try {
      await revokeUser(revokeId);
      setUsers(prev => prev.filter(u => u.id !== revokeId));
      setRevokeId(null);
    } finally {
      setRevoking(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: 'admin' | 'member' | 'tester') {
    setChangingRoleId(userId);
    try {
      await changeUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch {
      // revert is implicit — state unchanged on error
    } finally {
      setChangingRoleId(null);
    }
  }

  const isSuperAdmin = currentUser?.role === 'super-admin';

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-semibold text-foreground tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Invite-only access — manage your team here</p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Plus size={14} />
          Invite user
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium text-sm">{user.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.role === 'super-admin' ? (
                      <RoleBadge role={user.role} />
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={val => handleRoleChange(user.id, val as 'admin' | 'member' | 'tester')}
                        disabled={changingRoleId === user.id}
                      >
                        <SelectTrigger className="h-6 w-[90px] text-[11px] px-2 border-0 bg-transparent p-0 shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin" className="text-xs">admin</SelectItem>
                          <SelectItem value="member" className="text-xs">user</SelectItem>
                          <SelectItem value="tester" className="text-xs">tester</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-right">
                    {user.role !== 'super-admin' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRevokeId(user.id)}
                        className="h-7 px-2 hover:text-destructive"
                      >
                        <Trash2 size={12} />
                        Revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={open => !open && closeInviteDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
          </DialogHeader>

          {!inviteUrl ? (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && inviteEmail.trim() && handleInvite()}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  value={inviteRole}
                  onValueChange={val => setInviteRole(val as 'admin' | 'member' | 'tester')}
                >
                  <SelectTrigger id="invite-role" className="h-9 text-sm" style={{ width: 'auto' }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isSuperAdmin && (
                      <SelectItem value="admin" className="text-sm">
                        Admin — inbox + API management
                      </SelectItem>
                    )}
                    <SelectItem value="member" className="text-sm">
                      User — inbox access only
                    </SelectItem>
                    <SelectItem value="tester" className="text-sm">
                      Tester — test mailbox access only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {inviteError && (
                <Alert variant="destructive">
                  <AlertDescription>{inviteError}</AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={closeInviteDialog}>Cancel</Button>
                <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting && <Loader2 size={13} className="animate-spin" />}
                  {inviting ? 'Creating invite…' : 'Create invite'}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-2">
              <p className="text-sm text-muted-foreground">
                Share this invite link with <span className="font-medium text-foreground">{inviteEmail}</span>. It expires in 48 hours and can only be used once.
              </p>
              <div className="flex gap-2">
                <Input value={inviteUrl} readOnly className="font-mono text-xs flex-1" />
                <Button size="sm" variant="outline" onClick={copyInviteUrl} className="shrink-0">
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeInviteDialog}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <Dialog open={!!revokeId} onOpenChange={open => !open && setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke access?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This user will immediately lose access. Their data (emails, threads) will be retained.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking && <Loader2 size={13} className="animate-spin" />}
              Revoke access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
