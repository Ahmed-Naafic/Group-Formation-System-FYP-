import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Loader2, UserCheck, UserPlus, Pencil, ShieldOff, ShieldCheck, Search, Trash2,
  KeyRound, Copy, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetUsersQuery,
  useCreateInstructorMutation,
  useUpdateInstructorMutation,
  useActivateInstructorMutation,
  useDeactivateInstructorMutation,
  useDeleteInstructorMutation,
  useResetUserPasswordMutation,
  useDeactivateStudentAccountMutation,
  useRestoreUserMutation,
  useDeactivateAccountsByCohortMutation,
} from './userApi';
import { useGetCohortsQuery } from '@/features/cohort/cohortApi';
import {
  useGetStudentsQuery,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useResetStudentPasswordMutation,
} from '@/features/student/studentApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const ROLE_META = {
  admin: {
    singular: 'Admin',
    lower: 'admin',
    registerHint: 'Create a new admin account. They will log in with their email and this password.',
  },
  instructor: {
    singular: 'Instructor',
    lower: 'instructor',
    registerHint: 'Create a new instructor account. They will log in with their email and this password.',
  },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <button onClick={copy} className="ml-1 text-ink-400 hover:text-ink-700 transition-colors" aria-label="Copy">
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
    </button>
  );
}

// ── Admins / Instructors ─────────────────────────────────────────────────────

function StaffTab({ role }) {
  const meta = ROLE_META[role];
  const { data: staff = [], isLoading } = useGetUsersQuery({ role });

  const [createStaff,     { isLoading: registering }]  = useCreateInstructorMutation();
  const [updateStaff,     { isLoading: updating }]     = useUpdateInstructorMutation();
  const [activateUser,    { isLoading: activating }]   = useActivateInstructorMutation();
  const [deactivateUser,  { isLoading: deactivating }] = useDeactivateInstructorMutation();
  const [deleteStaff,     { isLoading: deleting }]     = useDeleteInstructorMutation();
  const [resetPassword,   { isLoading: resetting }]    = useResetUserPasswordMutation();

  const [query,            setQuery]            = useState('');
  const [registerOpen,     setRegisterOpen]     = useState(false);
  const [editTarget,       setEditTarget]       = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget,     setDeleteTarget]     = useState(null);
  const [resetTarget,      setResetTarget]      = useState(null);
  const [resetResult,      setResetResult]      = useState(null);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((u) =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q),
    );
  })();

  const { register: regReg,  handleSubmit: submitReg,  reset: resetReg,  formState: { errors: errReg  } } = useForm();
  const { register: regEdit, handleSubmit: submitEdit, reset: resetEdit, formState: { errors: errEdit } } = useForm();

  function openEdit(user) {
    setEditTarget(user);
    resetEdit({ fullName: user.fullName, email: user.email });
  }

  async function onRegister(data) {
    try {
      await createStaff({ ...data, role }).unwrap();
      toast.success(`${data.fullName} registered as ${meta.lower}`);
      setRegisterOpen(false);
      resetReg();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? `Failed to register ${meta.lower}`);
    }
  }

  async function onEditSave(data) {
    try {
      await updateStaff({ id: editTarget._id, fullName: data.fullName, email: data.email }).unwrap();
      toast.success(`${meta.singular} updated`);
      setEditTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? `Failed to update ${meta.lower}`);
    }
  }

  async function onActivate(user) {
    try {
      await activateUser(user._id).unwrap();
      toast.success(`${user.fullName} reactivated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to activate');
    }
  }

  async function onDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteStaff(deleteTarget._id).unwrap();
      toast.success(`${deleteTarget.fullName} deleted`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? `Failed to delete ${meta.lower}`);
    } finally {
      setDeleteTarget(null);
    }
  }

  async function onDeactivateConfirmed() {
    if (!deactivateTarget) return;
    try {
      await deactivateUser(deactivateTarget._id).unwrap();
      toast.success(`${deactivateTarget.fullName} deactivated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to deactivate');
    } finally {
      setDeactivateTarget(null);
    }
  }

  async function onResetConfirmed() {
    if (!resetTarget) return;
    try {
      const result = await resetPassword(resetTarget._id).unwrap();
      setResetTarget(null);
      setResetResult(result);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to reset password');
      setResetTarget(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">
            Registered {meta.singular}s
          </CardTitle>
          <Button size="sm" onClick={() => { resetReg(); setRegisterOpen(true); }}>
            <UserPlus size={14} />
            Register
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-ink-300" />
            </div>
          ) : staff.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <UserCheck size={28} className="text-ink-200 mb-2" />
              <p className="text-ink-400 text-sm">No {meta.lower}s registered yet.</p>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => { resetReg(); setRegisterOpen(true); }}>
                Register first {meta.lower}
              </Button>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border relative">
                <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <Input
                  placeholder="Search by name or email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-44" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-ink-400">No {meta.lower}s match "{query}"</TableCell></TableRow>
                  ) : filtered.map((u) => {
                    const isActive = u.isActive !== false;
                    const busy     = activating || deactivating;
                    return (
                      <TableRow key={u._id} className={!isActive ? 'opacity-60' : ''}>
                        <TableCell className="font-medium text-ink-800">{u.fullName}</TableCell>
                        <TableCell className="text-ink-500 text-sm">{u.email}</TableCell>
                        <TableCell>
                          {isActive ? (
                            <Badge variant="success" className="gap-1">
                              <ShieldCheck size={11} /> Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <ShieldOff size={11} /> Deactivated
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7"
                              onClick={() => openEdit(u)}
                              title={`Edit ${meta.lower}`}
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 text-amber-600 hover:text-amber-700"
                              onClick={() => setResetTarget(u)}
                              title="Reset password"
                            >
                              <KeyRound size={13} />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-7 w-7 hover:text-danger"
                              onClick={() => setDeleteTarget(u)}
                              title={`Delete ${meta.lower}`}
                            >
                              <Trash2 size={13} />
                            </Button>
                            {isActive ? (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 text-xs text-danger hover:text-danger hover:bg-danger/10 gap-1"
                                disabled={busy}
                                onClick={() => setDeactivateTarget(u)}
                              >
                                <ShieldOff size={12} /> Deactivate
                              </Button>
                            ) : (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 text-xs text-success hover:text-success hover:bg-success/10 gap-1"
                                disabled={busy}
                                onClick={() => onActivate(u)}
                              >
                                {activating ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                                Activate
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Register dialog */}
      <Dialog open={registerOpen} onOpenChange={(v) => { if (!v) { setRegisterOpen(false); resetReg(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Register {meta.singular}</DialogTitle>
            <DialogDescription>{meta.registerHint}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReg(onRegister)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor={`r-name-${role}`}>Full Name <span className="text-danger">*</span></Label>
              <Input id={`r-name-${role}`} placeholder="e.g. Dr. Amina Hassan"
                {...regReg('fullName', { required: 'Required', minLength: { value: 2, message: 'At least 2 characters' } })}
                aria-invalid={!!errReg.fullName} />
              {errReg.fullName && <p className="text-xs text-danger">{errReg.fullName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`r-email-${role}`}>Email <span className="text-danger">*</span></Label>
              <Input id={`r-email-${role}`} type="email" placeholder="name@university.edu"
                {...regReg('email', { required: 'Required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })}
                aria-invalid={!!errReg.email} />
              {errReg.email && <p className="text-xs text-danger">{errReg.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`r-pw-${role}`}>Password <span className="text-danger">*</span></Label>
              <Input id={`r-pw-${role}`} type="password" placeholder="Min 6 characters"
                {...regReg('password', { required: 'Required', minLength: { value: 6, message: 'At least 6 characters' } })}
                aria-invalid={!!errReg.password} />
              {errReg.password && <p className="text-xs text-danger">{errReg.password.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={registering}>
                {registering && <Loader2 size={14} className="animate-spin" />}
                Register
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog — no password field; use Reset Password for that */}
      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit {meta.singular}</DialogTitle>
            <DialogDescription>Update name or email. Use Reset Password to issue a new password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit(onEditSave)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor={`e-name-${role}`}>Full Name <span className="text-danger">*</span></Label>
              <Input id={`e-name-${role}`}
                {...regEdit('fullName', { required: 'Required', minLength: { value: 2, message: 'At least 2 characters' } })}
                aria-invalid={!!errEdit.fullName} />
              {errEdit.fullName && <p className="text-xs text-danger">{errEdit.fullName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`e-email-${role}`}>Email <span className="text-danger">*</span></Label>
              <Input id={`e-email-${role}`} type="email"
                {...regEdit('email', { required: 'Required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })}
                aria-invalid={!!errEdit.email} />
              {errEdit.email && <p className="text-xs text-danger">{errEdit.email.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={updating}>
                {updating && <Loader2 size={14} className="animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {meta.singular}</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <span className="font-semibold text-ink-800">{deleteTarget?.fullName}</span>?
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={onDeleteConfirmed}
              disabled={deleting}
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate confirm */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {meta.singular}</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-ink-800">{deactivateTarget?.fullName}</span> will
              no longer be able to log in. Their data is kept — reactivating them
              restores full access immediately. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={onDeactivateConfirmed}
              disabled={deactivating}
            >
              {deactivating && <Loader2 size={14} className="animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password confirm */}
      <AlertDialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Generate a new temporary password for <span className="font-semibold text-ink-800">{resetTarget?.fullName}</span>?
              They will be required to change it on next login.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onResetConfirmed} disabled={resetting} className="bg-amber-600 hover:bg-amber-700">
              {resetting && <Loader2 size={14} className="animate-spin" />}
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset result — temp password shown once */}
      <Dialog open={!!resetResult} onOpenChange={(v) => !v && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset</DialogTitle>
            <DialogDescription>Copy the new temporary password now — it will not be shown again.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-ink-600">
              <span className="font-medium">{resetResult?.fullName}</span>
              {' · '}
              <span className="text-xs text-ink-400">{resetResult?.email}</span>
            </p>
            <div className="flex items-center gap-2 rounded-md border px-4 py-3 bg-[var(--surface-warning)] border-[var(--surface-warning-border)]">
              <span className="flex-1 font-mono text-sm font-semibold text-[var(--fg-warning)] select-all">{resetResult?.tempPassword}</span>
              <CopyButton text={resetResult?.tempPassword ?? ''} />
            </div>
          </div>
          <DialogFooter><Button onClick={() => setResetResult(null)}>Done — I've saved the password</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Students ──────────────────────────────────────────────────────────────

function StudentsTab() {
  const { data: cohorts = [], isLoading: loadingCohorts } = useGetCohortsQuery();
  const [cohortId, setCohortId] = useState('');

  const { data: students = [], isLoading: loadingStudents } = useGetStudentsQuery(cohortId, { skip: !cohortId });
  const [updateStudent, { isLoading: updating }]  = useUpdateStudentMutation();
  const [deleteStudent, { isLoading: deleting }]  = useDeleteStudentMutation();
  const [resetPassword, { isLoading: resetting }] = useResetStudentPasswordMutation();
  const [deactivateAccount, { isLoading: deactivating }] = useDeactivateStudentAccountMutation();
  const [restoreAccount,    { isLoading: restoringAccount }] = useRestoreUserMutation();
  const [deactivateAllAccounts, { isLoading: deactivatingAll }] = useDeactivateAccountsByCohortMutation();

  const [query,            setQuery]            = useState('');
  const [editing,          setEditing]          = useState(null);
  const [deleteTarget,     setDeleteTarget]     = useState(null);
  const [resetTarget,      setResetTarget]      = useState(null);
  const [resetResult,      setResetResult]      = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateAllConfirm, setDeactivateAllConfirm] = useState(false);

  const activeAccountCount = students.filter((s) => s.userId && !s.userId.deletedAt).length;

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) =>
      s.fullName.toLowerCase().includes(q) ||
      (s.userId?.studentId ?? '').toLowerCase().includes(q),
    );
  })();

  const { register: regEdit, handleSubmit: submitEdit, reset: resetEdit, formState: { errors: errEdit } } = useForm();

  function openEdit(student) {
    setEditing(student);
    resetEdit({ fullName: student.fullName });
  }

  async function onEditSave(data) {
    try {
      await updateStudent({ id: editing._id, fullName: data.fullName.trim() }).unwrap();
      toast.success('Student updated');
      setEditing(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to update student');
    }
  }

  async function onDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteStudent(deleteTarget._id).unwrap();
      toast.success(`${deleteTarget.fullName} removed`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to remove student');
    } finally {
      setDeleteTarget(null);
    }
  }

  async function onResetConfirmed() {
    if (!resetTarget) return;
    try {
      const result = await resetPassword(resetTarget._id).unwrap();
      setResetTarget(null);
      setResetResult(result);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to reset password');
      setResetTarget(null);
    }
  }

  async function onDeactivateConfirmed() {
    if (!deactivateTarget) return;
    try {
      await deactivateAccount(deactivateTarget.userId._id).unwrap();
      toast.success(`${deactivateTarget.fullName}'s account deactivated — they can no longer log in`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to deactivate account');
    } finally {
      setDeactivateTarget(null);
    }
  }

  async function onRestoreAccount(student) {
    try {
      await restoreAccount(student.userId._id).unwrap();
      toast.success(`${student.fullName}'s account restored`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to restore account');
    }
  }

  async function onDeactivateAllConfirmed() {
    try {
      const result = await deactivateAllAccounts(cohortId).unwrap();
      toast.success(`${result.deactivated} account${result.deactivated !== 1 ? 's' : ''} deactivated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to deactivate accounts');
    } finally {
      setDeactivateAllConfirm(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">
            Students by Cohort
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div className="max-w-xs w-full">
              <Select value={cohortId} onValueChange={setCohortId} disabled={loadingCohorts}>
                <SelectTrigger><SelectValue placeholder="Select a cohort…" /></SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {cohortId && (
              <div className="flex gap-2 shrink-0">
                {activeAccountCount > 0 && (
                  <Button
                    variant="outline"
                    className="text-danger hover:text-danger hover:bg-danger/10 border-danger/30"
                    onClick={() => setDeactivateAllConfirm(true)}
                  >
                    <ShieldOff size={14} />
                    Deactivate All Accounts ({activeAccountCount})
                  </Button>
                )}
              </div>
            )}
          </div>

          {!cohortId ? (
            <p className="text-sm text-ink-400 py-6 text-center">Choose a cohort to view its students.</p>
          ) : loadingStudents ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-ink-300" />
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-ink-400 py-6 text-center">No students in this cohort.</p>
          ) : (
            <div className="rounded-lg border border-border">
              <div className="px-4 py-3 border-b border-border relative">
                <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <Input
                  placeholder="Search by name or student ID…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead className="w-28">Account</TableHead>
                    <TableHead className="w-44" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-ink-400">No students match "{query}"</TableCell></TableRow>
                  ) : filtered.map((s) => {
                    const accountActive = !!s.userId && !s.userId.deletedAt;
                    return (
                    <TableRow key={s._id}>
                      <TableCell className="font-mono text-xs text-ink-500">{s.userId?.studentId ?? '—'}</TableCell>
                      <TableCell className="font-medium text-ink-800">{s.fullName}</TableCell>
                      <TableCell>
                        {accountActive ? (
                          <Badge variant="success" className="gap-1">
                            <ShieldCheck size={11} /> Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldOff size={11} /> Deactivated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => openEdit(s)} title="Edit">
                            <Pencil size={13} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700"
                            onClick={() => setResetTarget(s)} title="Reset password" disabled={!accountActive}>
                            <KeyRound size={13} />
                          </Button>
                          {accountActive ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-danger hover:text-danger"
                              onClick={() => setDeactivateTarget(s)} title="Deactivate account" disabled={deactivating}>
                              <ShieldOff size={13} />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-success hover:text-success"
                              onClick={() => onRestoreAccount(s)} title="Restore account" disabled={restoringAccount}>
                              <ShieldCheck size={13} />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 hover:text-danger"
                            onClick={() => setDeleteTarget(s)}
                            title={accountActive ? 'Deactivate the account first' : 'Remove'}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Student ID cannot be changed after creation.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit(onEditSave)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="us-name">Full Name <span className="text-danger">*</span></Label>
              <Input id="us-name" {...regEdit('fullName', { required: 'Name is required', minLength: { value: 2 } })} aria-invalid={!!errEdit.fullName} />
              {errEdit.fullName && <p className="text-xs text-danger">{errEdit.fullName.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={updating}>
                {updating && <Loader2 size={14} className="animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student</AlertDialogTitle>
            {deleteTarget && !deleteTarget.userId?.deletedAt ? (
              <AlertDialogDescription>
                <span className="font-semibold text-ink-800">{deleteTarget.fullName}</span>'s account is
                still active. Deactivate it first (the shield icon in this row), then remove the student.
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription>
                Remove <span className="font-semibold text-ink-800">{deleteTarget?.fullName}</span> from this cohort?
                Their history is preserved and this can be undone from the trash bin below.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{deleteTarget && !deleteTarget.userId?.deletedAt ? 'Close' : 'Cancel'}</AlertDialogCancel>
            {deleteTarget && !deleteTarget.userId?.deletedAt ? null : (
              <AlertDialogAction onClick={onDeleteConfirmed} disabled={deleting}>
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Remove
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate all accounts (cohort) confirm */}
      <AlertDialog open={deactivateAllConfirm} onOpenChange={(v) => !v && setDeactivateAllConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate All Accounts</AlertDialogTitle>
            <AlertDialogDescription>
              Deactivate all <span className="font-semibold text-ink-800">{activeAccountCount}</span> active
              student account{activeAccountCount !== 1 ? 's' : ''} in this cohort? None of them will be able to
              log in afterward. This is the bulk way to unlock Clear Roster on the Students page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={onDeactivateAllConfirmed}
              disabled={deactivatingAll}
            >
              {deactivatingAll && <Loader2 size={14} className="animate-spin" />}
              Deactivate All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate account confirm */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Account</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-ink-800">{deactivateTarget?.fullName}</span> will
              no longer be able to log in. This unlocks removing them from the cohort — restoring the
              account later does not automatically restore the student record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={onDeactivateConfirmed}
              disabled={deactivating}
            >
              {deactivating && <Loader2 size={14} className="animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password confirm */}
      <AlertDialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Generate a new temporary password for <span className="font-semibold text-ink-800">{resetTarget?.fullName}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onResetConfirmed} disabled={resetting} className="bg-amber-600 hover:bg-amber-700">
              {resetting && <Loader2 size={14} className="animate-spin" />}
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset result */}
      <Dialog open={!!resetResult} onOpenChange={(v) => !v && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset</DialogTitle>
            <DialogDescription>Copy the new temporary password now — it will not be shown again.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-ink-600">
              <span className="font-medium">{resetResult?.fullName}</span>
              {' · '}
              <span className="font-mono text-xs text-ink-400">{resetResult?.studentId}</span>
            </p>
            <div className="flex items-center gap-2 rounded-md border px-4 py-3 bg-[var(--surface-warning)] border-[var(--surface-warning-border)]">
              <span className="flex-1 font-mono text-sm font-semibold text-[var(--fg-warning)] select-all">{resetResult?.tempPassword}</span>
              <CopyButton text={resetResult?.tempPassword ?? ''} />
            </div>
          </div>
          <DialogFooter><Button onClick={() => setResetResult(null)}>Done — I've saved the password</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'admins',      label: 'Admins' },
  { key: 'instructors', label: 'Instructors' },
  { key: 'students',    label: 'Students' },
];

function TabBar({ active, onChange }) {
  return (
    <div className="flex border-b border-border mb-6">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            active === t.key
              ? 'border-just-blue-600 text-just-blue-700'
              : 'border-transparent text-ink-500 hover:text-ink-700',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function UserManagementPage() {
  const [activeTab, setActiveTab] = useState('admins');

  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow mb-1">Users</p>
        <h2 className="text-ink-900 mb-1">User Management</h2>
        <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
          Manage admin, instructor, and student accounts. New admins and instructors are
          registered here; students are enrolled from their cohort's page.
        </p>
      </div>

      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'admins' && <StaffTab role="admin" />}
      {activeTab === 'instructors' && <StaffTab role="instructor" />}
      {activeTab === 'students' && <StudentsTab />}
    </div>
  );
}
