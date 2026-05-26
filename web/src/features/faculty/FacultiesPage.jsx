import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetFacultiesQuery,
  useCreateFacultyMutation,
  useUpdateFacultyMutation,
  useDeleteFacultyMutation,
} from './facultyApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export default function FacultiesPage() {
  const { data: faculties = [], isLoading, error } = useGetFacultiesQuery();
  const [createFaculty, { isLoading: creating }] = useCreateFacultyMutation();
  const [updateFaculty, { isLoading: updating }] = useUpdateFacultyMutation();
  const [deleteFaculty, { isLoading: deleting }] = useDeleteFacultyMutation();

  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editing, setEditing]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    reset(editing
      ? { name: editing.name, description: editing.description ?? '' }
      : { name: '', description: '' }
    );
  }, [editing, reset]);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(f)  { setEditing(f);    setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  async function onSubmit(data) {
    try {
      if (editing) {
        await updateFaculty({ id: editing._id, ...data }).unwrap();
        toast.success('Faculty updated');
      } else {
        await createFaculty(data).unwrap();
        toast.success('Faculty created');
      }
      closeDialog();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Something went wrong');
    }
  }

  async function confirmDelete() {
    try {
      await deleteFaculty(deleteTarget._id).unwrap();
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete faculty');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Academic Structure</p>
          <h2 className="text-ink-900 mb-1">Faculties</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            Top-level academic units. Departments belong to faculties.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 ml-4">
          <Plus size={16} /> New Faculty
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">
            {error?.data?.error?.message ?? 'Failed to load faculties.'}
          </p>
        ) : isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
        ) : faculties.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm mb-3">No faculties yet.</p>
            <Button variant="ghost" size="sm" onClick={openCreate}>Create the first faculty</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="whitespace-nowrap">Created</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {faculties.map((f) => (
                <TableRow key={f._id}>
                  <TableCell className="font-medium text-ink-800">{f.name}</TableCell>
                  <TableCell className="text-ink-400 max-w-xs truncate">{f.description || '—'}</TableCell>
                  <TableCell className="text-ink-400 whitespace-nowrap">{fmtDate(f.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)} aria-label="Edit">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" onClick={() => setDeleteTarget(f)} aria-label="Delete">
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
            <DialogTitle>{editing ? 'Edit Faculty' : 'New Faculty'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="f-name">Name <span className="text-danger">*</span></Label>
              <Input
                id="f-name"
                placeholder="e.g. Faculty of Information Technology"
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
              <Label htmlFor="f-desc">Description</Label>
              <Textarea
                id="f-desc"
                placeholder="Optional"
                rows={3}
                {...register('description', {
                  maxLength: { value: 500, message: 'Max 500 characters' },
                })}
              />
              {errors.description && <p className="text-xs text-danger">{errors.description.message}</p>}
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Faculty</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete{' '}
              <span className="font-semibold text-ink-800">{deleteTarget?.name}</span>?
              Departments under this faculty may also be affected.
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
