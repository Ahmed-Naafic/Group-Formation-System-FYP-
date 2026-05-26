import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
} from './departmentApi';
import { useGetFacultiesQuery } from '@/features/faculty/facultyApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const ALL = '__all__';

export default function DepartmentsPage() {
  const { data: departments = [], isLoading, error } = useGetDepartmentsQuery();
  const { data: faculties  = [] }                    = useGetFacultiesQuery();
  const [createDepartment, { isLoading: creating }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: updating }] = useUpdateDepartmentMutation();
  const [deleteDepartment, { isLoading: deleting }] = useDeleteDepartmentMutation();

  const [facultyFilter, setFacultyFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editing, setEditing]             = useState(null);
  const [deleteTarget, setDeleteTarget]   = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  const facultyMap = Object.fromEntries(faculties.map((f) => [f._id, f.name]));

  const visible = facultyFilter === ALL
    ? departments
    : departments.filter((d) => d.facultyId === facultyFilter);

  useEffect(() => {
    reset(editing
      ? { facultyId: editing.facultyId, name: editing.name, description: editing.description ?? '' }
      : { facultyId: '', name: '', description: '' }
    );
  }, [editing, reset]);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(d)  { setEditing(d);    setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  async function onSubmit(data) {
    try {
      if (editing) {
        await updateDepartment({ id: editing._id, ...data }).unwrap();
        toast.success('Department updated');
      } else {
        await createDepartment(data).unwrap();
        toast.success('Department created');
      }
      closeDialog();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Something went wrong');
    }
  }

  async function confirmDelete() {
    try {
      await deleteDepartment(deleteTarget._id).unwrap();
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete department');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Academic Structure</p>
          <h2 className="text-ink-900 mb-1">Departments</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            Departments belong to faculties and house courses.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 ml-4">
          <Plus size={16} /> New Department
        </Button>
      </div>

      {/* Filter toolbar */}
      {faculties.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-ink-500 font-medium">Filter by faculty</span>
          <Select value={facultyFilter} onValueChange={setFacultyFilter}>
            <SelectTrigger className="w-52 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All faculties</SelectItem>
              {faculties.map((f) => (
                <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">
            {error?.data?.error?.message ?? 'Failed to load departments.'}
          </p>
        ) : isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm mb-3">
              {facultyFilter !== ALL ? 'No departments in this faculty.' : 'No departments yet.'}
            </p>
            <Button variant="ghost" size="sm" onClick={openCreate}>Create the first department</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((d) => (
                <TableRow key={d._id}>
                  <TableCell className="font-medium text-ink-800">{d.name}</TableCell>
                  <TableCell className="text-ink-500">{facultyMap[d.facultyId] ?? '—'}</TableCell>
                  <TableCell className="text-ink-400 max-w-xs truncate">{d.description || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)} aria-label="Edit">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" onClick={() => setDeleteTarget(d)} aria-label="Delete">
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
            <DialogTitle>{editing ? 'Edit Department' : 'New Department'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label>Faculty <span className="text-danger">*</span></Label>
              <Controller
                control={control}
                name="facultyId"
                rules={{ required: 'Please select a faculty' }}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={!!errors.facultyId}>
                      <SelectValue placeholder="Select faculty…" />
                    </SelectTrigger>
                    <SelectContent>
                      {faculties.map((f) => (
                        <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.facultyId && <p className="text-xs text-danger">{errors.facultyId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-name">Name <span className="text-danger">*</span></Label>
              <Input
                id="d-name"
                placeholder="e.g. Department of Computer Science"
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
              <Label htmlFor="d-desc">Description</Label>
              <Textarea id="d-desc" placeholder="Optional" rows={3}
                {...register('description', { maxLength: { value: 500, message: 'Max 500 characters' } })}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete{' '}
              <span className="font-semibold text-ink-800">{deleteTarget?.name}</span>?
              Courses under this department may also be affected.
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
