import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Pencil, Trash2, Plus, Loader2, Users, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetClassesQuery,
  useCreateClassMutation,
  useUpdateClassMutation,
  useDeleteClassMutation,
} from './classApi';
import { useGetCoursesQuery }   from '@/features/course/courseApi';
import { useGetSemestersQuery } from '@/features/semester/semesterApi';
import { useGetCourseAssignmentsQuery } from '@/features/courseAssignment/courseAssignmentApi';
import { selectCurrentUser, selectRole } from '@/features/auth/authSlice';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ClassesPage() {
  const role    = useSelector(selectRole);
  const user    = useSelector(selectCurrentUser);
  const isAdmin = role === 'admin';

  const { data: allClasses  = [], isLoading, error } = useGetClassesQuery();
  const { data: assignments = [], isLoading: loadingAssignments } = useGetCourseAssignmentsQuery(undefined, { skip: isAdmin });
  const { data: courses     = [] }                   = useGetCoursesQuery();
  const { data: semesters   = [] }                   = useGetSemestersQuery();
  const [createClass, { isLoading: creating }] = useCreateClassMutation();
  const [updateClass, { isLoading: updating }] = useUpdateClassMutation();
  const [deleteClass, { isLoading: deleting }] = useDeleteClassMutation();

  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editing, setEditing]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm();

  const semesterMap = useMemo(() => Object.fromEntries(semesters.map((s) => [s._id, s])), [semesters]);

  // Instructors see only classes they are assigned to, and only their assigned courses per class
  const { myClassIds, myClassCoursesMap } = useMemo(() => {
    if (isAdmin) return { myClassIds: null, myClassCoursesMap: null };
    const classIds = new Set();
    const coursesMap = new Map();
    assignments.forEach((a) => {
      const cid = String(a.classId?._id ?? a.classId);
      classIds.add(cid);
      if (!coursesMap.has(cid)) coursesMap.set(cid, []);
      if (a.courseId) coursesMap.get(cid).push(a.courseId);
    });
    return { myClassIds: classIds, myClassCoursesMap: coursesMap };
  }, [isAdmin, assignments]);

  const classes = useMemo(
    () => isAdmin ? allClasses : allClasses.filter((cls) => myClassIds?.has(String(cls._id))),
    [isAdmin, allClasses, myClassIds],
  );

  const loading = isLoading || (!isAdmin && loadingAssignments);

  useEffect(() => {
    reset(editing ? {
      courseIds:   (editing.courseIds ?? []).map((c) => String(c._id ?? c)),
      semesterId:  editing.semesterId,
      name:        editing.name,
      maxStudents: editing.maxStudents ?? '',
    } : {
      courseIds: [], semesterId: '', name: '', maxStudents: '',
    });
  }, [editing, reset]);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(c)  { setEditing(c);    setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  async function onSubmit(data) {
    try {
      const payload = {
        ...data,
        maxStudents: data.maxStudents !== '' ? Number(data.maxStudents) : null,
      };
      if (editing) {
        await updateClass({ id: editing._id, ...payload }).unwrap();
        toast.success('Class updated');
      } else {
        await createClass(payload).unwrap();
        toast.success('Class created');
      }
      closeDialog();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Something went wrong');
    }
  }

  async function confirmDelete() {
    try {
      await deleteClass(deleteTarget._id).unwrap();
      toast.success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete class');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">{isAdmin ? 'Academic Structure' : 'My Teaching'}</p>
          <h2 className="text-ink-900 mb-1">{isAdmin ? 'Classes' : 'My Classes'}</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            {isAdmin
              ? 'A class is a group of students attending one or more courses in a semester.'
              : 'Classes you are currently assigned to teach.'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="shrink-0 ml-4">
            <Plus size={16} /> New Class
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">
            {error?.data?.error?.message ?? 'Failed to load classes.'}
          </p>
        ) : loading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
        ) : classes.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm mb-3">
              {isAdmin ? 'No classes yet.' : 'No classes assigned to you yet.'}
            </p>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={openCreate}>Create the first class</Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead className="w-28">Max Students</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((cls) => (
                <TableRow key={cls._id}>
                  <TableCell className="font-medium text-ink-800">{cls.name}</TableCell>
                  <TableCell>
                    {(() => {
                      const displayCourses = isAdmin
                        ? (cls.courseIds ?? [])
                        : (myClassCoursesMap?.get(String(cls._id)) ?? []);
                      return displayCourses.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {displayCourses.map((c) => (
                            <span
                              key={c._id ?? c}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-ink-100 text-ink-700"
                            >
                              {c.code && <span className="font-mono text-ink-400">{c.code}</span>}
                              {c.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-ink-300 text-xs">—</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-ink-500">
                    {semesterMap[cls.semesterId]?.name ?? (
                      <span className="text-ink-300 text-xs">{cls.semesterId}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-ink-500">
                    {cls.maxStudents ?? <span className="text-ink-300">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-just-blue-600 hover:text-just-blue-700"
                        asChild
                      >
                        <Link to={`/classes/${cls._id}/students`}>
                          <Users size={13} />
                          Students
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-just-blue-600 hover:text-just-blue-700"
                        asChild
                      >
                        <Link to={`/classes/${cls._id}/groups`}>
                          <Users2 size={13} />
                          Groups
                        </Link>
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cls)} aria-label="Edit">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" onClick={() => setDeleteTarget(cls)} aria-label="Delete">
                            <Trash2 size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit dialog (admin only) */}
      {isAdmin && (
        <>
          <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Class' : 'New Class'}</DialogTitle>
                <DialogDescription>
                  Assign instructors to courses within this class from the Instructors page.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>

                {/* Courses — multi-select checkbox list */}
                <div className="space-y-1.5">
                  <Label>Courses <span className="text-danger">*</span></Label>
                  <Controller
                    control={control}
                    name="courseIds"
                    rules={{ validate: (v) => (v?.length > 0) || 'Select at least one course' }}
                    render={({ field }) => (
                      <div
                        className="rounded-md border border-border max-h-44 overflow-y-auto divide-y divide-border"
                        style={errors.courseIds ? { borderColor: 'var(--color-danger)' } : {}}
                      >
                        {courses.length === 0 ? (
                          <p className="px-3 py-2 text-sm text-ink-400">No courses available.</p>
                        ) : courses.map((c) => {
                          const checked = (field.value ?? []).includes(c._id);
                          return (
                            <label
                              key={c._id}
                              className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50 cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? field.value.filter((id) => id !== c._id)
                                    : [...(field.value ?? []), c._id];
                                  field.onChange(next);
                                }}
                                className="h-4 w-4 rounded border-border accent-just-blue-600"
                              />
                              {c.code && (
                                <span className="font-mono text-xs text-ink-400 shrink-0">{c.code}</span>
                              )}
                              <span className="text-sm text-ink-800">{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  />
                  {errors.courseIds && (
                    <p className="text-xs text-danger">{errors.courseIds.message}</p>
                  )}
                </div>

                {/* Semester */}
                <div className="space-y-1.5">
                  <Label>Semester <span className="text-danger">*</span></Label>
                  <Controller
                    control={control}
                    name="semesterId"
                    rules={{ required: 'Please select a semester' }}
                    render={({ field }) => (
                      <Select value={field.value ?? ''} onValueChange={field.onChange}>
                        <SelectTrigger aria-invalid={!!errors.semesterId}>
                          <SelectValue placeholder="Select semester…" />
                        </SelectTrigger>
                        <SelectContent>
                          {semesters.map((s) => (
                            <SelectItem key={s._id} value={s._id}>{s.name} ({s.year})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.semesterId && <p className="text-xs text-danger">{errors.semesterId.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="cls-name">Class name <span className="text-danger">*</span></Label>
                    <Input
                      id="cls-name"
                      placeholder="e.g. CS101 — Group A"
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
                    <Label htmlFor="cls-max">Max students</Label>
                    <Input
                      id="cls-max"
                      type="number"
                      placeholder="Unlimited"
                      min={1}
                      {...register('maxStudents', { min: { value: 1, message: 'Min 1' } })}
                    />
                    {errors.maxStudents && <p className="text-xs text-danger">{errors.maxStudents.message}</p>}
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

          <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Class</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently delete{' '}
                  <span className="font-semibold text-ink-800">{deleteTarget?.name}</span>?
                  Students and groups in this class will also be removed.
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
        </>
      )}
    </div>
  );
}
