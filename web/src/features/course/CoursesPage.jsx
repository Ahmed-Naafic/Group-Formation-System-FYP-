import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetCoursesQuery,
  useCreateCourseMutation,
  useUpdateCourseMutation,
  useDeleteCourseMutation,
} from './courseApi';
import { useGetDepartmentsQuery } from '@/features/department/departmentApi';
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

export default function CoursesPage() {
  const { data: courses     = [], isLoading, error } = useGetCoursesQuery();
  const { data: departments = [] }                    = useGetDepartmentsQuery();
  const [createCourse, { isLoading: creating }] = useCreateCourseMutation();
  const [updateCourse, { isLoading: updating }] = useUpdateCourseMutation();
  const [deleteCourse, { isLoading: deleting }] = useDeleteCourseMutation();

  const [deptFilter, setDeptFilter]       = useState(ALL);
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editing, setEditing]             = useState(null);
  const [deleteTarget, setDeleteTarget]   = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  const deptMap = Object.fromEntries(departments.map((d) => [d._id, d.name]));

  const visible = deptFilter === ALL
    ? courses
    : courses.filter((c) => c.departmentId === deptFilter);

  useEffect(() => {
    reset(editing
      ? { departmentId: editing.departmentId, name: editing.name, code: editing.code, description: editing.description ?? '' }
      : { departmentId: '', name: '', code: '', description: '' }
    );
  }, [editing, reset]);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(c)  { setEditing(c);    setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  async function onSubmit(data) {
    try {
      const payload = { ...data, code: data.code.toUpperCase() };
      if (editing) {
        await updateCourse({ id: editing._id, ...payload }).unwrap();
        toast.success('Course updated');
      } else {
        await createCourse(payload).unwrap();
        toast.success('Course created');
      }
      closeDialog();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Something went wrong');
    }
  }

  async function confirmDelete() {
    try {
      await deleteCourse(deleteTarget._id).unwrap();
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete course');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Academic Structure</p>
          <h2 className="text-ink-900 mb-1">Courses</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            Courses belong to departments and are delivered as classes each semester.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 ml-4">
          <Plus size={16} /> New Course
        </Button>
      </div>

      {departments.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs text-ink-500 font-medium">Filter by department</span>
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">
            {error?.data?.error?.message ?? 'Failed to load courses.'}
          </p>
        ) : isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm mb-3">
              {deptFilter !== ALL ? 'No courses in this department.' : 'No courses yet.'}
            </p>
            <Button variant="ghost" size="sm" onClick={openCreate}>Create the first course</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => (
                <TableRow key={c._id}>
                  <TableCell>
                    <span
                      className="font-mono text-xs font-semibold tracking-wide px-1.5 py-0.5 rounded bg-ink-50 text-ink-600"
                    >
                      {c.code}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium text-ink-800">{c.name}</TableCell>
                  <TableCell className="text-ink-500">{deptMap[c.departmentId] ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)} aria-label="Edit">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" onClick={() => setDeleteTarget(c)} aria-label="Delete">
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
            <DialogTitle>{editing ? 'Edit Course' : 'New Course'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label>Department <span className="text-danger">*</span></Label>
              <Controller
                control={control}
                name="departmentId"
                rules={{ required: 'Please select a department' }}
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={!!errors.departmentId}>
                      <SelectValue placeholder="Select department…" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.departmentId && <p className="text-xs text-danger">{errors.departmentId.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-code">Code <span className="text-danger">*</span></Label>
                <Input
                  id="c-code"
                  placeholder="e.g. CS101"
                  className="uppercase"
                  style={{ textTransform: 'uppercase' }}
                  {...register('code', {
                    required: 'Code is required',
                    minLength: { value: 2, message: 'Min 2 chars' },
                    maxLength: { value: 20, message: 'Max 20 chars' },
                  })}
                  aria-invalid={!!errors.code}
                />
                {errors.code && <p className="text-xs text-danger">{errors.code.message}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="c-name">Name <span className="text-danger">*</span></Label>
                <Input
                  id="c-name"
                  placeholder="e.g. Introduction to Programming"
                  {...register('name', {
                    required: 'Name is required',
                    minLength: { value: 2, message: 'At least 2 characters' },
                    maxLength: { value: 150, message: 'Max 150 characters' },
                  })}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-desc">Description</Label>
              <Textarea id="c-desc" placeholder="Optional" rows={3}
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
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete{' '}
              <span className="font-semibold text-ink-800">{deleteTarget?.name}</span>?
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
