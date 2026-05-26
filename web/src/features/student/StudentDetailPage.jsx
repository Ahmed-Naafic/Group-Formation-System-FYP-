import { useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { KeyRound, Trash2, Loader2, Copy, Check, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetStudentByIdQuery,
  useUpdateStudentMutation,
  useDeleteStudentMutation,
  useResetStudentPasswordMutation,
} from './studentApi';
import { useUpdateScoresMutation } from '@/features/performance/performanceApi';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} className="ml-1 text-ink-400 hover:text-ink-700 transition-colors" aria-label="Copy">
      {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
    </button>
  );
}

export default function StudentDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const location     = useLocation();
  const classId      = location.state?.classId;

  const { data: student, isLoading, error } = useGetStudentByIdQuery(id);
  const [updateStudent, { isLoading: saving }]      = useUpdateStudentMutation();
  const [deleteStudent, { isLoading: deleting }]    = useDeleteStudentMutation();
  const [resetPassword, { isLoading: resetting }]   = useResetStudentPasswordMutation();
  const [updateScores]                              = useUpdateScoresMutation();

  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [resetOpen, setResetOpen]       = useState(false);
  const [resetResult, setResetResult]   = useState(null);

  const { register, handleSubmit, formState: { errors, isDirty } } = useForm({
    values: student ? {
      fullName:     student.fullName,
      attendance:   student.attendance,
      averageScore: student.averageScore ?? '',
    } : {},
  });

  async function onSave(data) {
    try {
      const averageScore = data.averageScore !== '' ? Number(data.averageScore) : null;

      await updateStudent({
        id,
        fullName:   data.fullName.trim(),
        attendance: Number(data.attendance) || 0,
        averageScore,
      }).unwrap();

      // Trigger recalculation when averageScore is provided
      if (averageScore !== null) {
        await updateScores({ studentId: id, averageScore }).unwrap();
      }

      toast.success('Student updated');
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to update student');
    }
  }

  async function confirmDelete() {
    try {
      await deleteStudent(id).unwrap();
      toast.success(`${student.fullName} removed`);
      navigate(classId ? `/classes/${classId}/students` : '/classes');
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to remove student');
    }
  }

  async function confirmReset() {
    try {
      const result = await resetPassword(id).unwrap();
      setResetOpen(false);
      setResetResult(result);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to reset password');
    }
  }

  const backTo = classId ? `/classes/${classId}/students` : '/classes';

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={22} className="animate-spin text-ink-300" />
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-danger mb-4">Student not found or you don't have access.</p>
        <Button variant="outline" onClick={() => navigate(backTo)}>Go back</Button>
      </div>
    );
  }

  const userId = student.userId;

  return (
    <div className="max-w-2xl">
      {/* Back link */}
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to students
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-ink-900 mb-0.5">{student.fullName}</h2>
          <p className="font-mono text-sm text-ink-400">{userId?.studentId}</p>
        </div>
        <Badge variant={CATEGORY_VARIANT[student.performanceCategory] ?? 'secondary'} className="text-sm px-3 py-1">
          {student.performanceCategory ?? 'UNGRADED'}
        </Badge>
      </div>

      <div className="space-y-5">
        {/* Account info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">Account</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <p className="text-ink-400 text-xs mb-0.5">Student ID</p>
              <p className="font-mono text-ink-700">{userId?.studentId ?? '—'}</p>
            </div>
            <div>
              <p className="text-ink-400 text-xs mb-0.5">Email</p>
              <p className="text-ink-700">{userId?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-ink-400 text-xs mb-0.5">Role</p>
              <p className="text-ink-700 capitalize">{userId?.role ?? '—'}</p>
            </div>
            <div>
              <p className="text-ink-400 text-xs mb-0.5">Status</p>
              <Badge variant={userId?.isActive ? 'success' : 'destructive'}>
                {userId?.isActive ? 'Active' : 'Deactivated'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">Performance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-ink-400 text-xs mb-0.5">Average Score</p>
              <p className="font-semibold text-ink-800">
                {student.averageScore != null
                  ? student.averageScore.toFixed(1)
                  : <span className="text-ink-300 font-normal">—</span>}
              </p>
            </div>
            <div>
              <p className="text-ink-400 text-xs mb-0.5">Attendance</p>
              <p className="font-semibold text-ink-800">{student.attendance ?? 0}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Edit form */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">Edit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSave)} className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="d-name">Full Name <span className="text-danger">*</span></Label>
                  <Input id="d-name"
                    {...register('fullName', { required: 'Required', minLength: { value: 2 } })}
                    aria-invalid={!!errors.fullName}
                  />
                  {errors.fullName && <p className="text-xs text-danger">{errors.fullName.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="d-att">Attendance %</Label>
                  <Input id="d-att" type="number" min={0} max={100}
                    {...register('attendance', { min: { value: 0 }, max: { value: 100 } })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="d-avg">Average Score (0–100)</Label>
                <Input id="d-avg" type="number" min={0} max={100} step="0.01" placeholder="— ungraded"
                  {...register('averageScore', { min: { value: 0, message: 'Min 0' }, max: { value: 100, message: 'Max 100' } })}
                />
                {errors.averageScore && <p className="text-xs text-danger">{errors.averageScore.message}</p>}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={saving || !isDirty}>
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-red-100">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={() => setResetOpen(true)}
            >
              <KeyRound size={15} />
              Reset Password
            </Button>
            <Button
              variant="outline"
              className="border-red-200 text-danger hover:bg-red-50"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={15} />
              Remove from Class
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Student</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <span className="font-semibold text-ink-800">{student.fullName}</span> from
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

      {/* Reset confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Password</AlertDialogTitle>
            <AlertDialogDescription>
              Generate a new temporary password for{' '}
              <span className="font-semibold text-ink-800">{student.fullName}</span>?
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

      {/* Reset result */}
      <Dialog open={!!resetResult} onOpenChange={(v) => !v && setResetResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset</DialogTitle>
            <DialogDescription>
              Copy this temporary password now — it will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-ink-600">
              <span className="font-medium">{resetResult?.fullName}</span>
              {' · '}
              <span className="font-mono text-xs text-ink-400">{resetResult?.studentId}</span>
            </p>
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-3">
              <span className="flex-1 font-mono text-sm font-semibold text-amber-900 dark:text-amber-200 select-all">
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
