import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { Pencil, Trash2, Plus, Loader2, Users2, ClipboardList, Search, History } from 'lucide-react';
import { toast } from 'sonner';
import { useSelector } from 'react-redux';
import {
  useGetCourseOfferingsQuery,
  useCreateCourseOfferingMutation,
  useUpdateCourseOfferingMutation,
  useDeleteCourseOfferingMutation,
  useGetInstructorHistoryQuery,
} from './courseOfferingApi';
import { useGetCoursesQuery }     from '@/features/course/courseApi';
import { useGetCohortsQuery }     from '@/features/cohort/cohortApi';
import { useGetSemestersQuery }   from '@/features/semester/semesterApi';
import { useGetAcademicYearsQuery } from '@/features/academicYear/academicYearApi';
import { useGetUsersQuery }       from '@/features/user/userApi';
import { selectRole }             from '@/features/auth/authSlice';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const STATUS_VARIANT = { active: 'success', completed: 'default', cancelled: 'destructive' };
const ALL = '__all__';

// Hoisted out of the page component (rather than defined inline in render)
// so it isn't recreated — and its Select's internal state reset — on every
// render; control/errors come from the page's useForm() instance as props.
function SelectField({ control, errors, name, label, options, required, disabled, onValueChange, placeholder }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-danger"> *</span>}</Label>
      <Controller
        control={control}
        name={name}
        rules={required ? { required: `${label} is required` } : {}}
        render={({ field }) => (
          <Select value={field.value} onValueChange={onValueChange ?? field.onChange} disabled={disabled}>
            <SelectTrigger aria-invalid={!!errors[name]}><SelectValue placeholder={placeholder ?? 'Select…'} /></SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {errors[name] && <p className="text-xs text-danger">{errors[name].message}</p>}
    </div>
  );
}

export default function CourseOfferingsPage() {
  const role = useSelector(selectRole);
  const isAdmin = role === 'admin';

  const { data: offerings  = [], isLoading, error } = useGetCourseOfferingsQuery();
  const { data: courses    = [] } = useGetCoursesQuery();
  const { data: cohorts    = [] } = useGetCohortsQuery();
  const { data: semesters  = [] } = useGetSemestersQuery();
  const { data: academicYears = [] } = useGetAcademicYearsQuery();
  // Deactivated instructors must not be assignable to offerings.
  const { data: activeInstructors = [] } = useGetUsersQuery({ role: 'instructor', isActive: true });

  const [createCourseOffering, { isLoading: creating }] = useCreateCourseOfferingMutation();
  const [updateCourseOffering, { isLoading: updating }] = useUpdateCourseOfferingMutation();
  const [deleteCourseOffering, { isLoading: deleting }] = useDeleteCourseOfferingMutation();

  const [query,          setQuery]          = useState('');
  const [cohortFilter,   setCohortFilter]   = useState(ALL);
  const [semesterFilter, setSemesterFilter] = useState(ALL);
  const [dialogOpen,     setDialogOpen]     = useState(false);
  const [editing,        setEditing]        = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [historyTarget,  setHistoryTarget]  = useState(null);

  const { register, handleSubmit, reset, control, setValue, formState: { errors } } = useForm();

  // The offering being edited might currently be taught by an instructor who
  // has since been deactivated — keep them selectable (as the current value)
  // even though they're excluded from the active list for new assignments.
  const instructors = useMemo(() => {
    const current = editing?.instructorId;
    if (!current || current.isActive !== false) return activeInstructors;
    if (activeInstructors.some((u) => u._id === current._id)) return activeInstructors;
    return [...activeInstructors, current];
  }, [activeInstructors, editing]);

  const watchedInstructorId = useWatch({ control, name: 'instructorId' });
  const originalInstructorId = String(editing?.instructorId?._id ?? editing?.instructorId ?? '');
  const isReassigning = !!editing && !!watchedInstructorId && watchedInstructorId !== originalInstructorId;

  // Academic Year -> Semester cascade (create form only — semester is fixed
  // once an offering exists). Selecting a year loads only its 10 semesters;
  // changing it resets the semester field so a stale cross-year selection
  // can never be submitted.
  const watchedAcademicYearId = useWatch({ control, name: 'academicYearId' });
  const semestersForSelectedAY = watchedAcademicYearId
    ? semesters.filter((s) => String(s.academicYearId?._id ?? s.academicYearId ?? '') === watchedAcademicYearId)
    : [];
  function handleAcademicYearChange(nextId) {
    setValue('academicYearId', nextId, { shouldValidate: true });
    setValue('semesterId', '', { shouldValidate: false });
  }

  // Build lookup maps
  const courseMap   = Object.fromEntries(courses.map((c)    => [c._id, `${c.name} (${c.code})`]));
  const cohortMap   = Object.fromEntries(cohorts.map((c)    => [c._id, c.name]));
  const ayNameById  = Object.fromEntries(academicYears.map((y) => [y._id, y.name]));
  // "Semester 1" alone is ambiguous once every academic year has its own —
  // disambiguate everywhere a semester name is shown standalone (filter
  // dropdown, table cell).
  function semesterLabel(s) {
    const ayId = String(s.academicYearId?._id ?? s.academicYearId ?? '');
    const ayName = s.academicYearId?.name ?? ayNameById[ayId] ?? '—';
    return `${ayName} — ${s.name}`;
  }
  const semMap       = Object.fromEntries(semesters.map((s) => [s._id, semesterLabel(s)]));
  const instrMap     = Object.fromEntries(instructors.map((u) => [u._id, u.fullName]));

  const visible = offerings.filter((o) => {
    const cid = String(o.cohortId?._id   ?? o.cohortId ?? '');
    const sid = String(o.semesterId?._id ?? o.semesterId ?? '');
    if (cohortFilter   !== ALL && cid !== cohortFilter)   return false;
    if (semesterFilter !== ALL && sid !== semesterFilter) return false;
    const q = query.trim().toLowerCase();
    if (q) {
      const courseName = courseMap[String(o.courseId?._id ?? o.courseId ?? '')] ?? '';
      if (!courseName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  useEffect(() => {
    if (!editing) {
      reset({ courseId: '', cohortId: '', academicYearId: '', semesterId: '', instructorId: '', maxStudents: '', status: 'active', reason: '' });
      return;
    }
    reset({
      courseId:     String(editing.courseId?._id     ?? editing.courseId     ?? ''),
      cohortId:     String(editing.cohortId?._id     ?? editing.cohortId     ?? ''),
      academicYearId: String(editing.semesterId?.academicYearId?._id ?? editing.semesterId?.academicYearId ?? ''),
      semesterId:   String(editing.semesterId?._id   ?? editing.semesterId   ?? ''),
      instructorId: String(editing.instructorId?._id ?? editing.instructorId ?? ''),
      maxStudents:  editing.maxStudents ?? '',
      status:       editing.status,
      reason:       '',
    });
  }, [editing, reset]);

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(o)  { setEditing(o);    setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  async function onSubmit(data) {
    try {
      const payload = {
        ...data,
        maxStudents: data.maxStudents ? Number(data.maxStudents) : null,
      };
      if (editing) {
        // Only instructor, maxStudents, status are editable after creation.
        // reason is only meaningful when instructorId is actually changing —
        // the backend ignores it otherwise.
        const { instructorId, maxStudents, status, reason } = payload;
        await updateCourseOffering({ id: editing._id, instructorId, maxStudents, status, reason }).unwrap();
        toast.success(isReassigning ? 'Instructor reassigned' : 'Course offering updated');
      } else {
        await createCourseOffering(payload).unwrap();
        toast.success('Course offering created');
      }
      closeDialog();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Something went wrong');
    }
  }

  async function confirmDelete() {
    try {
      await deleteCourseOffering(deleteTarget._id).unwrap();
      toast.success('Course offering deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete course offering');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Operations</p>
          <h2 className="text-ink-900 mb-1">Course Offerings</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            One course offered to one cohort in one semester, taught by one instructor.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="shrink-0 ml-4">
            <Plus size={16} /> New Offering
          </Button>
        )}
      </div>

      <div className="mb-3 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
        <Input
          placeholder="Search by course name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-ink-500 font-medium">Filter</span>
        <Select value={cohortFilter} onValueChange={setCohortFilter}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="All cohorts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All cohorts</SelectItem>
            {cohorts.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={semesterFilter} onValueChange={setSemesterFilter}>
          <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="All semesters" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All semesters</SelectItem>
            {semesters.map((s) => <SelectItem key={s._id} value={s._id}>{semesterLabel(s)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load offerings.'}</p>
        ) : isLoading ? (
          <div className="flex justify-center p-12"><Loader2 size={20} className="animate-spin text-ink-300" /></div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm mb-3">No course offerings yet.</p>
            {isAdmin && <Button variant="ghost" size="sm" onClick={openCreate}>Create the first offering</Button>}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Cohort</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-44" />
                {isAdmin && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((o) => {
                const courseId = String(o.courseId?._id   ?? o.courseId   ?? '');
                const cohortId = String(o.cohortId?._id   ?? o.cohortId   ?? '');
                const semId    = String(o.semesterId?._id ?? o.semesterId ?? '');
                const instrId  = String(o.instructorId?._id ?? o.instructorId ?? '');
                return (
                  <TableRow key={o._id}>
                    <TableCell className="font-medium text-ink-800">
                      {o.courseId?.name ?? courseMap[courseId] ?? '—'}
                      {o.courseId?.code && <span className="ml-1.5 text-xs text-ink-400">({o.courseId.code})</span>}
                    </TableCell>
                    <TableCell className="text-ink-500">{o.cohortId?.name ?? cohortMap[cohortId] ?? '—'}</TableCell>
                    <TableCell className="text-ink-500">{o.semesterId ? semesterLabel(o.semesterId) : (semMap[semId] ?? '—')}</TableCell>
                    <TableCell className="text-ink-500">{o.instructorId?.fullName ?? instrMap[instrId] ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[o.status] ?? 'secondary'}>{o.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-just-blue-600 hover:text-just-blue-700" asChild>
                          <Link to={`/course-offerings/${o._id}/groups`}><Users2 size={12} /> Groups</Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-just-blue-600 hover:text-just-blue-700" asChild>
                          <Link to={`/course-offerings/${o._id}/tasks`}><ClipboardList size={12} /> Tasks</Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-just-blue-600 hover:text-just-blue-700" asChild>
                          <Link to={`/course-offerings/${o._id}/attendance`}>Attendance</Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-just-blue-600 hover:text-just-blue-700" asChild>
                          <Link to={`/course-offerings/${o._id}/history`}><History size={12} /> Group History</Link>
                        </Button>
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHistoryTarget(o)} aria-label="Instructor history">
                            <History size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(o)} aria-label="Edit">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-danger" onClick={() => setDeleteTarget(o)} aria-label="Delete">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Course Offering' : 'New Course Offering'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {!editing && (
              <>
                <SelectField control={control} errors={errors} name="courseId" label="Course" required
                  options={courses.map((c) => ({ value: c._id, label: `${c.name} (${c.code})` }))} />
                <SelectField control={control} errors={errors} name="cohortId" label="Cohort" required
                  options={cohorts.map((c) => ({ value: c._id, label: c.name }))} />
                {/* Academic Year is selected first — the Semester dropdown only
                    loads once a year is picked, and only shows that year's own
                    10 semesters (never another year's). */}
                <div className="grid grid-cols-2 gap-3">
                  <SelectField control={control} errors={errors} name="academicYearId" label="Academic Year" required
                    options={academicYears.map((y) => ({ value: y._id, label: y.name }))}
                    onValueChange={handleAcademicYearChange} />
                  <SelectField control={control} errors={errors} name="semesterId" label="Semester" required
                    disabled={!watchedAcademicYearId}
                    placeholder={watchedAcademicYearId ? 'Select…' : 'Select an academic year first'}
                    options={semestersForSelectedAY.map((s) => ({ value: s._id, label: s.name }))} />
                </div>
              </>
            )}
            <SelectField control={control} errors={errors} name="instructorId" label="Instructor" required
              options={instructors.map((u) => ({ value: u._id, label: u.fullName }))} />
            {isReassigning && (
              <div className="space-y-1.5">
                <Label htmlFor="of-reason">
                  Reassignment reason
                  <span className="ml-1.5 text-xs font-normal text-ink-400">(optional)</span>
                </Label>
                <Input
                  id="of-reason"
                  placeholder="e.g. Instructor on leave"
                  {...register('reason', { maxLength: { value: 500, message: 'Max 500 characters' } })}
                />
                {errors.reason && <p className="text-xs text-danger">{errors.reason.message}</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="of-max">Max Students</Label>
                <Input
                  id="of-max"
                  type="number"
                  placeholder="No limit"
                  {...register('maxStudents', {
                    min: { value: 1, message: 'Must be ≥ 1' },
                  })}
                />
                {errors.maxStudents && <p className="text-xs text-danger">{errors.maxStudents.message}</p>}
              </div>
              {editing && (
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              )}
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
            <AlertDialogTitle>Delete Course Offering</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this offering for{' '}
              <span className="font-semibold text-ink-800">
                {deleteTarget?.courseId?.name ?? 'this course'}
              </span>?
              Active groups or attendance records must be removed first.
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

      {/* Instructor assignment history */}
      <InstructorHistoryDialog offering={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  );
}

// ── Instructor assignment history dialog ─────────────────────────────────────

function InstructorHistoryDialog({ offering, onClose }) {
  const { data: history = [], isLoading } = useGetInstructorHistoryQuery(offering?._id, { skip: !offering });

  function formatDate(d) {
    if (!d) return 'Present';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <Dialog open={!!offering} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Instructor History</DialogTitle>
          <DialogDescription>
            {offering?.courseId?.name ?? 'This course offering'} — every instructor assignment, most recent first.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} className="animate-spin text-ink-300" />
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-ink-400 py-4 text-center">No assignment history yet.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {history.map((h) => (
              <div key={h._id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-800">{h.instructorId?.fullName ?? '—'}</span>
                  {!h.endDate && <Badge variant="success">Current</Badge>}
                </div>
                <p className="text-xs text-ink-500 mt-0.5">
                  {formatDate(h.startDate)} – {formatDate(h.endDate)}
                </p>
                {h.assignedBy?.fullName && (
                  <p className="text-xs text-ink-400 mt-1">Assigned by {h.assignedBy.fullName}</p>
                )}
                {h.reason && <p className="text-xs text-ink-500 mt-1 italic">"{h.reason}"</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
