import { useState } from 'react';
import { Loader2, Trash, Trash2, Undo2, ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetStudentTrashQuery,
  useRestoreStudentMutation,
  usePermanentDeleteStudentMutation,
} from './studentApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TrashPage() {
  const { data: trash = [], isLoading, error } = useGetStudentTrashQuery();
  const [restoreStudent,  { isLoading: restoring }]  = useRestoreStudentMutation();
  const [permanentDelete, { isLoading: deleting }]   = usePermanentDeleteStudentMutation();

  const [permanentTarget,     setPermanentTarget]     = useState(null);
  const [restoreAllConfirm,   setRestoreAllConfirm]   = useState(false);
  const [deleteAllConfirm,    setDeleteAllConfirm]    = useState(false);
  const [bulkRestoring,       setBulkRestoring]       = useState(false);
  const [bulkDeleting,        setBulkDeleting]        = useState(false);

  const deletableCount = trash.filter((s) => s.canPermanentlyDelete !== false).length;

  async function onRestore(student) {
    try {
      await restoreStudent(student._id).unwrap();
      toast.success(`${student.fullName} restored`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to restore student');
    }
  }

  async function onPermanentDeleteConfirmed() {
    if (!permanentTarget) return;
    try {
      await permanentDelete(permanentTarget._id).unwrap();
      toast.success(`${permanentTarget.fullName} permanently deleted`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to permanently delete student');
    } finally {
      setPermanentTarget(null);
    }
  }

  // The backend's bulk restore/permanent-delete endpoints are cohort-scoped
  // (the Trash bin used to be too) — this page spans every cohort the caller
  // can see, so "All" here means looping the same per-student endpoints
  // already used for the individual actions above, one call per row.
  async function onRestoreAllConfirmed() {
    setRestoreAllConfirm(false);
    setBulkRestoring(true);
    const results = await Promise.allSettled(trash.map((s) => restoreStudent(s._id).unwrap()));
    setBulkRestoring(false);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (failed === 0) {
      toast.success(`${succeeded} student${succeeded !== 1 ? 's' : ''} restored`);
    } else {
      toast.error(`${succeeded} restored, ${failed} failed — check individual rows for details`);
    }
  }

  async function onDeleteAllConfirmed() {
    setDeleteAllConfirm(false);
    const targets = trash.filter((s) => s.canPermanentlyDelete !== false);
    setBulkDeleting(true);
    const results = await Promise.allSettled(targets.map((s) => permanentDelete(s._id).unwrap()));
    setBulkDeleting(false);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    const skipped = trash.length - targets.length;
    toast[failed === 0 ? 'success' : 'error'](
      `${succeeded} permanently deleted` +
      (failed > 0 ? `, ${failed} failed` : '') +
      (skipped > 0 ? `, ${skipped} kept (has group formation history)` : ''),
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-3">
        <div>
          <h2 className="text-ink-900 leading-none">Trash</h2>
          <p className="text-sm text-ink-500 mt-1">
            {trash.length > 0
              ? `${trash.length} removed student${trash.length !== 1 ? 's' : ''}`
              : 'Removed students, across every cohort you can access'}
          </p>
        </div>
        {trash.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline" size="sm"
              className="text-success hover:text-success hover:bg-success/10 border-success/30"
              onClick={() => setRestoreAllConfirm(true)}
              disabled={bulkRestoring || bulkDeleting}
            >
              {bulkRestoring ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
              Restore All ({trash.length})
            </Button>
            {deletableCount > 0 && (
              <Button
                variant="outline" size="sm"
                className="text-danger hover:text-danger hover:bg-danger/10 border-danger/30"
                onClick={() => setDeleteAllConfirm(true)}
                disabled={bulkRestoring || bulkDeleting}
              >
                {bulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Permanently Delete All ({deletableCount})
              </Button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-ink-300" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load trash.'}</p>
      ) : trash.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white py-16 flex flex-col items-center gap-3">
          <Trash size={32} className="text-ink-200" />
          <p className="text-sm text-ink-400">Trash is empty.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Deleted</TableHead>
                <TableHead>Deleted By</TableHead>
                <TableHead className="w-56" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {trash.map((s) => {
                const accountActive = !!s.userId && !s.userId.deletedAt;
                return (
                  <TableRow key={s._id}>
                    <TableCell className="font-mono text-xs text-ink-500">{s.userId?.studentId ?? '—'}</TableCell>
                    <TableCell className="font-medium text-ink-800">{s.fullName}</TableCell>
                    <TableCell className="text-sm text-ink-600">{s.cohortId?.name ?? '—'}</TableCell>
                    <TableCell>
                      {accountActive ? (
                        <Badge variant="success" className="gap-1"><ShieldCheck size={11} /> Active</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1"><ShieldOff size={11} /> Deactivated</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-ink-500 whitespace-nowrap">{formatDate(s.deletedAt)}</TableCell>
                    <TableCell className="text-xs text-ink-500">
                      {s.deletedBy?.fullName ?? s.deletedBy?.email ?? '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs gap-1 text-success hover:text-success hover:bg-success/10"
                          onClick={() => onRestore(s)}
                          disabled={restoring || bulkRestoring}
                          title="Restore student — reactivates the account too, if needed"
                        >
                          <Undo2 size={12} /> Restore
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 text-xs gap-1 text-danger hover:text-danger hover:bg-danger/10 disabled:text-ink-300 disabled:hover:bg-transparent"
                          onClick={() => setPermanentTarget(s)}
                          disabled={s.canPermanentlyDelete === false || bulkDeleting}
                          title={s.canPermanentlyDelete === false ? s.blockedReason : 'Permanently delete'}
                        >
                          <Trash2 size={12} /> Delete
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

      {/* Restore all confirm */}
      <AlertDialog open={restoreAllConfirm} onOpenChange={(v) => !v && setRestoreAllConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore All Students</AlertDialogTitle>
            <AlertDialogDescription>
              Restore all <span className="font-semibold text-ink-800">{trash.length}</span> student{trash.length !== 1 ? 's' : ''} from
              the trash back into their cohorts? Any deactivated account is reactivated automatically as part of
              restoring its student.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRestoreAllConfirmed}>Restore All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanently delete all confirm */}
      <AlertDialog open={deleteAllConfirm} onOpenChange={(v) => !v && setDeleteAllConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete All</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete <span className="font-semibold text-ink-800">{deletableCount}</span> student{deletableCount !== 1 ? 's' : ''}?
              This cannot be undone.
              {trash.length - deletableCount > 0 && (
                <> {trash.length - deletableCount} other{trash.length - deletableCount !== 1 ? 's' : ''} will be kept in the trash — they have group formation history.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-danger hover:bg-danger/90 text-white" onClick={onDeleteAllConfirmed}>
              Permanently Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent delete confirm */}
      <AlertDialog open={!!permanentTarget} onOpenChange={(v) => !v && setPermanentTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Student</AlertDialogTitle>
            {permanentTarget?.canPermanentlyDelete === false ? (
              <AlertDialogDescription className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-danger shrink-0 mt-0.5" />
                <span>{permanentTarget.blockedReason}</span>
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription>
                Permanently delete <span className="font-semibold text-ink-800">{permanentTarget?.fullName}</span>?
                This cannot be undone — the student record, and their account if it isn't used elsewhere, will be
                removed for good.
              </AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{permanentTarget?.canPermanentlyDelete === false ? 'Close' : 'Cancel'}</AlertDialogCancel>
            {permanentTarget?.canPermanentlyDelete === false ? null : (
              <AlertDialogAction
                className="bg-danger hover:bg-danger/90 text-white"
                onClick={onPermanentDeleteConfirmed}
                disabled={deleting}
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Permanently Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
