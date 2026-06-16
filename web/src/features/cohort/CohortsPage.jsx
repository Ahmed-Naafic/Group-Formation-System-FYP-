import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetCohortsQuery,
  useCreateCohortMutation,
  useUpdateCohortMutation,
  useDeleteCohortMutation,
} from './cohortApi';
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

const ALL = '__all__';

export default function CohortsPage() {
  const { data: cohorts     = [], isLoading, error } = useGetCohortsQuery();
  const { data: departments = [] }                    = useGetDepartmentsQuery();
  const [createCohort, { isLoading: creating }] = useCreateCohortMutation();
  const [updateCohort, { isLoading: updating }] = useUpdateCohortMutation();
  const [deleteCohort, { isLoading: deleting }] = useDeleteCohortMutation();

  const [deptFilter, setDeptFilter]     = useState(ALL);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editing, setEditing]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  const deptMap = Object.fromEntries(departments.map((d) => [d._id, d.name]));

  const visible = deptFilter === ALL
    ? cohorts
    : cohorts.filter((c) => {
        const did = c.departmentId?._id ?? c.departmentId;
        return String(did) === deptFilter;
      });

  useEffect(() => {
    reset(editing ? {
      name:         editing.name,
      departmentId: String(editing.departmentId?._id ?? editing.departmentId ?? ''),
      yearOfEntry:  editing.yearOfEntry ?? '',
      description:  editing.description ?? '',
    } : {
      name: '', departmentId: '', yearOfEntry: '', description: '',
    });
  }, [editing, reset]);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(c)  { setEditing(c);    setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  async function onSubmit(data) {
    try {
      const payload = {
        ...data,
        yearOfEntry: data.yearOfEntry ? Number(data.yearOfEntry) : null,
      };
      if (editing) {
        await updateCohort({ id: editing._id, ...payload }).unwrap();
        toast.success('Cohort updated');
      } else {
        await createCohort(payload).unwrap();
        toast.success('Cohort created');
      }
      closeDialog();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Something went wrong');
    }
  }

  async function confirmDelete() {
    try {
      await deleteCohort(deleteTarget._id).unwrap();
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete cohort');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Operations</p>
          <h2 className="text-ink-900 mb-1">Cohorts</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            Permanent student groups. Students upload once; offerings repeat each semester.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 ml-4">
          <Plus size={16} /> New Cohort
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-ink-500 font-medium">Filter by department</span>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-52 h-8 text-xs">
            <SelectValue placeholder="All departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d._id} value={d._id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load cohorts.'}</p>
        ) : isLoading ? (
          <div className="flex justify-center p-12"><Loader2 size={20} className="animate-spin text-ink-300" /></div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm mb-3">No cohorts yet.</p>
            <Button variant="ghost" size="sm" onClick={openCreate}>Create the first cohort</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="w-28">Year of Entry</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((c) => {
                const deptId = String(c.departmentId?._id ?? c.departmentId ?? '');
                return (
                  <TableRow key={c._id}>
                    <TableCell className="font-medium text-ink-800">{c.name}</TableCell>
                    <TableCell className="text-ink-500">{deptMap[deptId] ?? '—'}</TableCell>
                    <TableCell className="text-ink-500">{c.yearOfEntry ?? '—'}</TableCell>
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
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Cohort' : 'New Cohort'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="co-name">Name <span className="text-danger">*</span></Label>
              <Input
                id="co-name"
                placeholder="e.g. CA226"
                {...register('name', {
                  required: 'Name is required',
                  maxLength: { value: 50, message: 'Max 50 characters' },
                })}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Department <span className="text-danger">*</span></Label>
                <Controller
                  control={control}
                  name="departmentId"
                  rules={{ required: 'Department is required' }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!errors.departmentId}>
                        <SelectValue placeholder="Select…" />
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
              <div className="space-y-1.5">
                <Label htmlFor="co-year">Year of Entry</Label>
                <Input
                  id="co-year"
                  type="number"
                  placeholder="e.g. 2022"
                  {...register('yearOfEntry', {
                    min: { value: 1950, message: 'Min 1950' },
                    max: { value: 2100, message: 'Max 2100' },
                  })}
                />
                {errors.yearOfEntry && <p className="text-xs text-danger">{errors.yearOfEntry.message}</p>}
              </div>
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
            <AlertDialogTitle>Delete Cohort</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-semibold text-ink-800">{deleteTarget?.name}</span>?
              Active students or course offerings must be removed first.
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
