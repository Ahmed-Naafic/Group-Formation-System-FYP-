import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetSemestersQuery,
  useCreateSemesterMutation,
  useUpdateSemesterMutation,
  useDeleteSemesterMutation,
} from './semesterApi';
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

// ISO string → "YYYY-MM-DD" for <input type="date">
function toDateInput(iso) {
  return iso ? iso.slice(0, 10) : '';
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

const ALL = '__all__';

export default function SemestersPage() {
  const { data: semesters = [], isLoading, error } = useGetSemestersQuery();
  const [createSemester, { isLoading: creating }] = useCreateSemesterMutation();
  const [updateSemester, { isLoading: updating }] = useUpdateSemesterMutation();
  const [deleteSemester, { isLoading: deleting }] = useDeleteSemesterMutation();

  const [statusFilter, setStatusFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editing, setEditing]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  const visible = statusFilter === ALL
    ? semesters
    : semesters.filter((s) => s.status === statusFilter);

  useEffect(() => {
    reset(editing ? {
      name:      editing.name,
      year:      editing.year,
      startDate: toDateInput(editing.startDate),
      endDate:   toDateInput(editing.endDate),
      status:    editing.status,
    } : {
      name: '', year: new Date().getFullYear(), startDate: '', endDate: '', status: 'active',
    });
  }, [editing, reset]);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(s)  { setEditing(s);    setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  async function onSubmit(data) {
    try {
      const payload = { ...data, year: Number(data.year) };
      if (editing) {
        await updateSemester({ id: editing._id, ...payload }).unwrap();
        toast.success('Semester updated');
      } else {
        await createSemester(payload).unwrap();
        toast.success('Semester created');
      }
      closeDialog();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Something went wrong');
    }
  }

  async function confirmDelete() {
    try {
      await deleteSemester(deleteTarget._id).unwrap();
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete semester');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Academic Structure</p>
          <h2 className="text-ink-900 mb-1">Semesters</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            Time periods during which classes run.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 ml-4">
          <Plus size={16} /> New Semester
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
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">
            {error?.data?.error?.message ?? 'Failed to load semesters.'}
          </p>
        ) : isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm mb-3">No semesters yet.</p>
            <Button variant="ghost" size="sm" onClick={openCreate}>Create the first semester</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="w-16">Year</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => (
                <TableRow key={s._id}>
                  <TableCell className="font-medium text-ink-800">{s.name}</TableCell>
                  <TableCell className="text-ink-500">{s.year}</TableCell>
                  <TableCell className="text-ink-500 whitespace-nowrap">
                    {fmtDate(s.startDate)} – {fmtDate(s.endDate)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === 'active' ? 'success' : 'secondary'}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)} aria-label="Edit">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" onClick={() => setDeleteTarget(s)} aria-label="Delete">
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

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Semester' : 'New Semester'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="s-name">Name <span className="text-danger">*</span></Label>
                <Input
                  id="s-name"
                  placeholder="e.g. Fall 2024"
                  {...register('name', {
                    required: 'Name is required',
                    minLength: { value: 2, message: 'At least 2 characters' },
                    maxLength: { value: 100, message: 'Max 100 characters' },
                  })}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-year">Year <span className="text-danger">*</span></Label>
                <Input
                  id="s-year"
                  type="number"
                  placeholder="2025"
                  {...register('year', {
                    required: 'Year is required',
                    min: { value: 2000, message: 'Min 2000' },
                    max: { value: 2100, message: 'Max 2100' },
                  })}
                  aria-invalid={!!errors.year}
                />
                {errors.year && <p className="text-xs text-danger">{errors.year.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-start">Start date <span className="text-danger">*</span></Label>
                <Input
                  id="s-start"
                  type="date"
                  {...register('startDate', { required: 'Start date is required' })}
                  aria-invalid={!!errors.startDate}
                />
                {errors.startDate && <p className="text-xs text-danger">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-end">End date <span className="text-danger">*</span></Label>
                <Input
                  id="s-end"
                  type="date"
                  {...register('endDate', { required: 'End date is required' })}
                  aria-invalid={!!errors.endDate}
                />
                {errors.endDate && <p className="text-xs text-danger">{errors.endDate.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Semester</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete{' '}
              <span className="font-semibold text-ink-800">{deleteTarget?.name}</span>?
              Classes running in this semester may also be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
