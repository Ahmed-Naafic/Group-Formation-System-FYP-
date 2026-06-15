import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Pencil, Trash2, Plus, Loader2, Upload, KeyRound, Eye, Copy, Check, BarChart2, Users2, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { useSelector } from 'react-redux';
import {
  useGetStudentsQuery,
  useCreateStudentMutation,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useResetStudentPasswordMutation,
  useClearRosterMutation,
} from './studentApi';
import { useGetClassByIdQuery } from '@/features/class/classApi';
import { useUpdateScoresMutation } from '@/features/performance/performanceApi';
import { selectRole } from '@/features/auth/authSlice';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

function CategoryBadge({ category }) {
  return (
    <Badge variant={CATEGORY_VARIANT[category] ?? 'secondary'}>
      {category ?? 'UNGRADED'}
    </Badge>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="ml-1 text-ink-400 hover:text-ink-700 transition-colors"
      aria-label="Copy"
    >
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const { classId } = useParams();
  const navigate    = useNavigate();
  const isAdmin     = useSelector(selectRole) === 'admin';

  const { data: cls,      isLoading: loadingClass   } = useGetClassByIdQuery(classId);
  const { data: students = [], isLoading, error }      = useGetStudentsQuery(classId);
  const [createStudent, { isLoading: creating }]      = useCreateStudentMutation();
  const [updateStudent, { isLoading: updating }]      = useUpdateStudentMutation();
  const [deleteStudent, { isLoading: deleting }]      = useDeleteStudentMutation();
  const [resetPassword, { isLoading: resetting }]     = useResetStudentPasswordMutation();
  const [clearRoster,   { isLoading: clearing }]      = useClearRosterMutation();
  const [updateScores]                                = useUpdateScoresMutation();

  const [createOpen, setCreateOpen]         = useState(false);
  const [editing, setEditing]               = useState(null);
  const [deleteTarget, setDeleteTarget]     = useState(null);
  const [resetTarget, setResetTarget]       = useState(null);
  const [createdResult, setCreatedResult]   = useState(null);
  const [resetResult, setResetResult]       = useState(null);
  const [clearConfirm, setClearConfirm]     = useState(false);

  const { register: regCreate, handleSubmit: submitCreate, reset: resetCreate, formState: { errors: errCreate } } = useForm({
    defaultValues: { attendance: 0 },
  });

  const { register: regEdit, handleSubmit: submitEdit, reset: resetEdit, formState: { errors: errEdit } } = useForm();

  useEffect(() => {
    if (editing) {
      resetEdit({
        fullName:     editing.fullName,
        attendance:   editing.attendance,
        averageScore: editing.averageScore ?? '',
      });
    }
  }, [editing, resetEdit]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function onCreateSubmit(data) {
    try {
      const payload = {
        classId,
        studentId:    data.studentId.trim(),
        fullName:     data.fullName.trim(),
        attendance:   Number(data.attendance) || 0,
        averageScore: data.averageScore !== '' ? Number(data.averageScore) : null,
      };
      const result = await createStudent(payload).unwrap();
      setCreateOpen(false);
      resetCreate({ attendance: 0 });
      if (result.tempPassword) {
        setCreatedResult(result);
      } else {
        toast.success(`${result.student.fullName} added`);
      }
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to add student');
    }
  }

  async function onEditSubmit(data) {
    try {
      const averageScore = data.averageScore !== '' ? Number(data.averageScore) : null;

      await updateStudent({
        id:           editing._id,
        fullName:     data.fullName.trim(),
        attendance:   Number(data.attendance) || 0,
        averageScore,
      }).unwrap();

      // Trigger recalculation whenever averageScore is provided
      if (averageScore !== null) {
        await updateScores({ studentId: editing._id, averageScore }).unwrap();
      }

      toast.success('Student updated');
      setEditing(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to update student');
    }
  }

  async function confirmDelete() {
    try {
      await deleteStudent(deleteTarget._id).unwrap();
      toast.success(`${deleteTarget.fullName} removed`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to remove student');
    }
  }

  async function confirmReset() {
    try {
      const result = await resetPassword(resetTarget._id).unwrap();
      setResetTarget(null);
      setResetResult(result);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to reset password');
    }
  }

  async function confirmClearRoster() {
    try {
      const result = await clearRoster(classId).unwrap();
      setClearConfirm(false);
      toast.success(`${result.removed} student${result.removed !== 1 ? 's' : ''} removed from class`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to clear roster');
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const className = cls?.name ?? (loadingClass ? '…' : 'Class');

  return (
    <div>
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">
            <Link to="/classes" className="hover:underline">Classes</Link>
            {' / '}
            {className}
          </p>
          <h2 className="text-ink-900 mb-1">Students</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            {students.length} student{students.length !== 1 ? 's' : ''} enrolled
          </p>
        </div>
        <div className="flex gap-2 ml-4 shrink-0">
          <Button variant="outline" asChild>
            <Link to={`/classes/${classId}/groups`}>
              <Users2 size={15} />
              Groups
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/classes/${classId}/scores`}>
              <BarChart2 size={15} />
              Grades
            </Link>
          </Button>
          {isAdmin && (
            <>
              {students.length > 0 && (
                <Button
                  variant="outline"
                  className="text-danger hover:text-danger hover:bg-danger/10 border-danger/30"
                  onClick={() => setClearConfirm(true)}
                >
                  <UserX size={15} />
                  Clear Roster
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link to={`/classes/${classId}/students/upload`}>
                  <Upload size={15} />
                  Upload CSV
                </Link>
              </Button>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus size={15} />
                Add Student
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Students table */}
      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">
            {error?.data?.error?.message ?? 'Failed to load students.'}
          </p>
        ) : isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm mb-3">No students yet.</p>
            {isAdmin && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCreateOpen(true)}>Add manually</Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/classes/${classId}/students/upload`}>Upload CSV</Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead className="w-24 text-right">Attendance</TableHead>
                <TableHead className="w-28 text-right">Avg Score</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s._id}>
                  <TableCell className="font-mono text-xs text-ink-500">
                    {s.userId?.studentId ?? '—'}
                  </TableCell>
                  <TableCell className="font-medium text-ink-800">{s.fullName}</TableCell>
                  <TableCell className="text-right text-ink-500">{s.attendance ?? 0}%</TableCell>
                  <TableCell className="text-right text-ink-500">
                    {s.averageScore != null
                      ? s.averageScore.toFixed(1)
                      : <span className="text-ink-300">—</span>}
                  </TableCell>
                  <TableCell><CategoryBadge category={s.performanceCategory} /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => navigate(`/students/${s._id}`, { state: { classId } })}
                        aria-label="View detail"
                      >
                        <Eye size={14} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => setEditing(s)}
                        aria-label="Edit"
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700"
                        onClick={() => setResetTarget(s)}
                        aria-label="Reset password"
                      >
                        <KeyRound size={14} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8 hover:text-danger"
                        onClick={() => setDeleteTarget(s)}
                        aria-label="Remove"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Create student dialog ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) { setCreateOpen(false); resetCreate({ attendance: 0 }); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>A temporary password will be generated for new accounts.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate(onCreateSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sid">Student ID <span className="text-danger">*</span></Label>
                <Input id="sid" placeholder="e.g. ST2024001"
                  {...regCreate('studentId', { required: 'Student ID is required' })}
                  aria-invalid={!!errCreate.studentId}
                />
                {errCreate.studentId && <p className="text-xs text-danger">{errCreate.studentId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sname">Full Name <span className="text-danger">*</span></Label>
                <Input id="sname" placeholder="e.g. Amina Hassan"
                  {...regCreate('fullName', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })}
                  aria-invalid={!!errCreate.fullName}
                />
                {errCreate.fullName && <p className="text-xs text-danger">{errCreate.fullName.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="satt">Attendance %</Label>
                <Input id="satt" type="number" min={0} max={100} placeholder="0"
                  {...regCreate('attendance', { min: { value: 0 }, max: { value: 100 } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="savg">Average Score (0–100)</Label>
                <Input id="savg" type="number" min={0} max={100} step="0.01" placeholder="— ungraded"
                  {...regCreate('averageScore', { min: { value: 0, message: 'Min 0' }, max: { value: 100, message: 'Max 100' } })}
                />
                {errCreate.averageScore && <p className="text-xs text-danger">{errCreate.averageScore.message}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 size={14} className="animate-spin" />}
                Add Student
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit student dialog ───────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>Student ID cannot be changed after creation.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit(onEditSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-name">Full Name <span className="text-danger">*</span></Label>
                <Input id="e-name"
                  {...regEdit('fullName', { required: 'Name is required', minLength: { value: 2 } })}
                  aria-invalid={!!errEdit.fullName}
                />
                {errEdit.fullName && <p className="text-xs text-danger">{errEdit.fullName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-att">Attendance %</Label>
                <Input id="e-att" type="number" min={0} max={100}
                  {...regEdit('attendance', { min: { value: 0 }, max: { value: 100 } })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-avg">Average Score (0–100)</Label>
              <Input id="e-avg" type="number" min={0} max={100} step="0.01" placeholder="— ungraded"
                {...regEdit('averageScore', { min: { value: 0, message: 'Min 0' }, max: { value: 100, message: 'Max 100' } })}
              />
              {errEdit.averageScore && <p className="text-xs text-danger">{errEdit.averageScore.message}</p>}
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

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="font-semibold text-ink-800">{deleteTarget?.fullName}</span> from
              this class? Their user account is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reset password confirm ────────────────────────────────────────── */}
      <AlertDialog open={!!resetTarget} onOpenChange={(v) => !v && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Generate a new temporary password for{' '}
              <span className="font-semibold text-ink-800">{resetTarget?.fullName}</span>?
              Their current password will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmReset}
              disabled={resetting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {resetting && <Loader2 size={14} className="animate-spin" />}
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Created — temp password display ──────────────────────────────── */}
      <Dialog open={!!createdResult} onOpenChange={(v) => !v && setCreatedResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student Added</DialogTitle>
            <DialogDescription>
              Copy the temporary password now — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-ink-600">
              <span className="font-medium">{createdResult?.student?.fullName}</span>
              {' · '}
              <span className="font-mono text-xs text-ink-400">
                {createdResult?.student?.userId?.studentId}
              </span>
            </p>
            <div className="flex items-center gap-2 rounded-md border px-4 py-3 bg-[var(--surface-warning)] border-[var(--surface-warning-border)]">
              <span className="flex-1 font-mono text-sm font-semibold text-[var(--fg-warning)] select-all">
                {createdResult?.tempPassword}
              </span>
              <CopyButton text={createdResult?.tempPassword ?? ''} />
            </div>
            <p className="text-xs text-ink-400">
              The student must use this password to log in for the first time and will be
              prompted to set a new one.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedResult(null)}>Done — I've saved the password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Clear roster confirm ─────────────────────────────────────────── */}
      <AlertDialog open={clearConfirm} onOpenChange={(v) => !v && setClearConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Entire Roster</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all{' '}
              <span className="font-semibold text-ink-800">{students.length} student{students.length !== 1 ? 's' : ''}</span>{' '}
              from <span className="font-semibold text-ink-800">{className}</span>. Student user
              accounts are preserved — only their enrollment in this class is removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={confirmClearRoster}
              disabled={clearing}
            >
              {clearing && <Loader2 size={14} className="animate-spin" />}
              Remove All Students
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Reset result — temp password display ─────────────────────────── */}
      <Dialog open={!!resetResult} onOpenChange={(v) => !v && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset</DialogTitle>
            <DialogDescription>
              Copy the new temporary password now — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-ink-600">
              <span className="font-medium">{resetResult?.fullName}</span>
              {' · '}
              <span className="font-mono text-xs text-ink-400">{resetResult?.studentId}</span>
            </p>
            <div className="flex items-center gap-2 rounded-md border px-4 py-3 bg-[var(--surface-warning)] border-[var(--surface-warning-border)]">
              <span className="flex-1 font-mono text-sm font-semibold text-[var(--fg-warning)] select-all">
                {resetResult?.tempPassword}
              </span>
              <CopyButton text={resetResult?.tempPassword ?? ''} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetResult(null)}>Done — I've saved the password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
