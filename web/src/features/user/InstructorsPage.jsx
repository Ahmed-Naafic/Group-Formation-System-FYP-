import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, UserCheck, UserPlus, Pencil, ShieldOff, ShieldCheck, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetUsersQuery,
  useCreateInstructorMutation,
  useUpdateInstructorMutation,
  useActivateInstructorMutation,
  useDeactivateInstructorMutation,
  useDeleteInstructorMutation,
} from './userApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function InstructorsPage() {
  const { data: instructors = [], isLoading } = useGetUsersQuery({ role: 'instructor' });

  const [createInstructor, { isLoading: registering }]  = useCreateInstructorMutation();
  const [updateInstructor, { isLoading: updating }]     = useUpdateInstructorMutation();
  const [activateUser,     { isLoading: activating }]   = useActivateInstructorMutation();
  const [deactivateUser,   { isLoading: deactivating }] = useDeactivateInstructorMutation();
  const [deleteInstructor, { isLoading: deleting }]     = useDeleteInstructorMutation();

  const [query,            setQuery]           = useState('');
  const [registerOpen,     setRegisterOpen]    = useState(false);

  const filtered = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return instructors;
    return instructors.filter((u) =>
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q),
    );
  })();
  const [editTarget,       setEditTarget]      = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget,     setDeleteTarget]     = useState(null);

  const { register: regReg,  handleSubmit: submitReg,  reset: resetReg,  formState: { errors: errReg  } } = useForm();
  const { register: regEdit, handleSubmit: submitEdit, reset: resetEdit, formState: { errors: errEdit } } = useForm();

  function openEdit(instructor) {
    setEditTarget(instructor);
    resetEdit({ fullName: instructor.fullName, email: instructor.email, password: '' });
  }

  async function onRegister(data) {
    try {
      await createInstructor(data).unwrap();
      toast.success(`${data.fullName} registered as instructor`);
      setRegisterOpen(false);
      resetReg();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to register instructor');
    }
  }

  async function onEditSave(data) {
    const payload = { id: editTarget._id, fullName: data.fullName, email: data.email };
    if (data.password) payload.password = data.password;
    try {
      await updateInstructor(payload).unwrap();
      toast.success('Instructor updated');
      setEditTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to update instructor');
    }
  }

  async function onActivate(instructor) {
    try {
      await activateUser(instructor._id).unwrap();
      toast.success(`${instructor.fullName} reactivated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to activate');
    }
  }

  async function onDeleteConfirmed() {
    if (!deleteTarget) return;
    try {
      await deleteInstructor(deleteTarget._id).unwrap();
      toast.success(`${deleteTarget.fullName} deleted`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete instructor');
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

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Users</p>
        <h2 className="text-ink-900 mb-1">Instructors</h2>
        <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
          Register instructor accounts and manage access. Assign instructors to courses via Course Offerings.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">
            Registered Instructors
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
          ) : instructors.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <UserCheck size={28} className="text-ink-200 mb-2" />
              <p className="text-ink-400 text-sm">No instructors registered yet.</p>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => { resetReg(); setRegisterOpen(true); }}>
                Register first instructor
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
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-sm text-ink-400">No instructors match "{query}"</TableCell></TableRow>
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
                            title="Edit instructor"
                          >
                            <Pencil size={13} />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 hover:text-danger"
                            onClick={() => setDeleteTarget(u)}
                            title="Delete instructor"
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
            <DialogTitle>Register Instructor</DialogTitle>
            <DialogDescription>
              Create a new instructor account. They will log in with their email and this password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReg(onRegister)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="r-name">Full Name <span className="text-danger">*</span></Label>
              <Input id="r-name" placeholder="e.g. Dr. Amina Hassan"
                {...regReg('fullName', { required: 'Required', minLength: { value: 2, message: 'At least 2 characters' } })}
                aria-invalid={!!errReg.fullName} />
              {errReg.fullName && <p className="text-xs text-danger">{errReg.fullName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-email">Email <span className="text-danger">*</span></Label>
              <Input id="r-email" type="email" placeholder="instructor@university.edu"
                {...regReg('email', { required: 'Required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })}
                aria-invalid={!!errReg.email} />
              {errReg.email && <p className="text-xs text-danger">{errReg.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-pw">Password <span className="text-danger">*</span></Label>
              <Input id="r-pw" type="password" placeholder="Min 6 characters"
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

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Instructor</DialogTitle>
            <DialogDescription>Update name, email, or set a new password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit(onEditSave)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="e-name">Full Name <span className="text-danger">*</span></Label>
              <Input id="e-name"
                {...regEdit('fullName', { required: 'Required', minLength: { value: 2, message: 'At least 2 characters' } })}
                aria-invalid={!!errEdit.fullName} />
              {errEdit.fullName && <p className="text-xs text-danger">{errEdit.fullName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-email">Email <span className="text-danger">*</span></Label>
              <Input id="e-email" type="email"
                {...regEdit('email', { required: 'Required', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' } })}
                aria-invalid={!!errEdit.email} />
              {errEdit.email && <p className="text-xs text-danger">{errEdit.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-pw">
                New Password
                <span className="ml-1.5 text-xs font-normal text-ink-400">(leave blank to keep current)</span>
              </Label>
              <Input id="e-pw" type="password" placeholder="Min 6 characters"
                {...regEdit('password', { minLength: { value: 6, message: 'At least 6 characters' } })}
                aria-invalid={!!errEdit.password} />
              {errEdit.password && <p className="text-xs text-danger">{errEdit.password.message}</p>}
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
            <AlertDialogTitle>Delete Instructor</AlertDialogTitle>
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
            <AlertDialogTitle>Deactivate Instructor</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-ink-800">{deactivateTarget?.fullName}</span> will
              no longer be able to log in. Their offerings and data are kept — reactivating them
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
    </div>
  );
}
