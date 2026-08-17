import { useState, useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Pencil, Trash2, Plus, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetAcademicYearsQuery,
  useCreateAcademicYearMutation,
  useUpdateAcademicYearMutation,
  useDeleteAcademicYearMutation,
} from './academicYearApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function toDateInput(iso) { return iso ? iso.slice(0, 10) : ''; }
function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

// Mirrors the backend's academicYearRules.deriveName exactly — parsed as UTC
// midnight (matching how Joi/Mongoose interpret a plain YYYY-MM-DD value) so
// the preview shown here can never disagree with what the server actually
// saves, regardless of the admin's local timezone.
function deriveNamePreview(startDateStr) {
  if (!startDateStr) return '';
  const d = new Date(`${startDateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getUTCFullYear();
  return `${year}/${year + 1}`;
}

const STATUS_VARIANT = { CURRENT: 'success', UPCOMING: 'default', CLOSED: 'secondary' };
const ALL = '__all__';

export default function AcademicYearsPage() {
  const { data: years = [], isLoading, error } = useGetAcademicYearsQuery();
  const [createAcademicYear, { isLoading: creating }] = useCreateAcademicYearMutation();
  const [updateAcademicYear, { isLoading: updating }] = useUpdateAcademicYearMutation();
  const [deleteAcademicYear, { isLoading: deleting }] = useDeleteAcademicYearMutation();

  const [statusFilter, setStatusFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editing, setEditing]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [formError, setFormError]       = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();
  const startDate = useWatch({ control, name: 'startDate' });
  const namePreview = deriveNamePreview(startDate);

  const visible = statusFilter === ALL ? years : years.filter((y) => y.effectiveStatus === statusFilter);

  useEffect(() => {
    reset(editing ? {
      startDate: toDateInput(editing.startDate),
      endDate:   toDateInput(editing.endDate),
    } : {
      startDate: '', endDate: '',
    });
  }, [editing, reset]);

  function openCreate() { setEditing(null); setFormError(null); setDialogOpen(true); }
  function openEdit(y)  { setEditing(y);    setFormError(null); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); setFormError(null); }

  function extractMessage(err) {
    const e = err?.data?.error;
    return e?.details?.length ? e.details.join(' · ') : (e?.message ?? 'Something went wrong');
  }

  async function onSubmit(data) {
    setFormError(null);
    try {
      if (editing) {
        await updateAcademicYear({ id: editing._id, ...data }).unwrap();
        toast.success('Academic year updated');
      } else {
        await createAcademicYear(data).unwrap();
        toast.success('Academic year created');
      }
      closeDialog();
    } catch (err) {
      setFormError(extractMessage(err));
    }
  }

  async function confirmDelete() {
    try {
      await deleteAcademicYear(deleteTarget._id).unwrap();
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractMessage(err));
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Academic Structure</p>
          <h2 className="text-ink-900 mb-1">Academic Years</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            Full academic years that own semesters and course offerings.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 ml-4">
          <Plus size={16} /> New Academic Year
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-ink-500 font-medium">Filter by status</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            <SelectItem value="UPCOMING">Upcoming</SelectItem>
            <SelectItem value="CURRENT">Current</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load academic years.'}</p>
        ) : isLoading ? (
          <div className="flex justify-center p-12"><Loader2 size={20} className="animate-spin text-ink-300" /></div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm mb-3">No academic years yet.</p>
            <Button variant="ghost" size="sm" onClick={openCreate}>Create the first academic year</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((y) => (
                <TableRow key={y._id}>
                  <TableCell className="font-medium text-ink-800">{y.name}</TableCell>
                  <TableCell className="text-ink-500 whitespace-nowrap">
                    {fmtDate(y.startDate)} – {fmtDate(y.endDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[y.effectiveStatus] ?? 'secondary'}>{y.effectiveStatus}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(y)} aria-label="Edit">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" onClick={() => setDeleteTarget(y)} aria-label="Delete">
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

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Academic Year' : 'New Academic Year'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ay-start">Start date <span className="text-danger">*</span></Label>
                <Input id="ay-start" type="date" {...register('startDate', { required: 'Required' })} aria-invalid={!!errors.startDate} />
                {errors.startDate && <p className="text-xs text-danger">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ay-end">End date <span className="text-danger">*</span></Label>
                <Input id="ay-end" type="date" {...register('endDate', { required: 'Required' })} aria-invalid={!!errors.endDate} />
                {errors.endDate && <p className="text-xs text-danger">{errors.endDate.message}</p>}
              </div>
            </div>

            {/* Read-only, server-derived — there is no text input for this. */}
            <div className="space-y-1.5">
              <Label>Academic Year</Label>
              <div className="rounded-md border border-border bg-ink-50/60 px-3 py-2 text-sm font-medium text-ink-700">
                {namePreview || <span className="text-ink-400 font-normal">Select a start date to preview</span>}
              </div>
              <p className="flex items-start gap-1.5 text-xs text-ink-400">
                <Info size={13} className="mt-0.5 shrink-0" />
                Duration must be 9–12 months, and only the next sequential year after the latest
                one can be created — allowed once the current year has one month or less remaining.
              </p>
            </div>

            {formError && (
              <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                {formError}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={creating || updating}>
                {(creating || updating) && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Save changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Academic Year</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-semibold text-ink-800">{deleteTarget?.name}</span>?
              Semesters belonging to this year must be removed first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-danger hover:bg-danger/90 text-white">
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
