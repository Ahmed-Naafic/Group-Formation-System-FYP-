import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Loader2, UserCheck, UserPlus, Pencil, ShieldOff, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetCourseAssignmentsQuery,
  useCreateCourseAssignmentMutation,
  useDeleteCourseAssignmentMutation,
} from './courseAssignmentApi';
import {
  useGetUsersQuery,
  useCreateInstructorMutation,
  useUpdateInstructorMutation,
  useActivateInstructorMutation,
  useDeactivateInstructorMutation,
} from '@/features/user/userApi';
import { useGetClassesQuery } from '@/features/class/classApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export default function InstructorsPage() {
  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: assignments = [], isLoading: loadingAssignments, refetch: refetchAssignments } = useGetCourseAssignmentsQuery();
  const { data: instructors = [], isLoading: loadingInstructors } = useGetUsersQuery({ role: 'instructor' });
  const { data: classes     = [] }                                = useGetClassesQuery();

  const [createInstructor,  { isLoading: registering }] = useCreateInstructorMutation();
  const [updateInstructor,  { isLoading: updating }]    = useUpdateInstructorMutation();
  const [activateUser,      { isLoading: activating }]  = useActivateInstructorMutation();
  const [deactivateUser,    { isLoading: deactivating }] = useDeactivateInstructorMutation();
  const [createAssignment,  { isLoading: assigning }]   = useCreateCourseAssignmentMutation();
  const [deleteAssignment,  { isLoading: deleting }]    = useDeleteCourseAssignmentMutation();

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [registerOpen,        setRegisterOpen]      = useState(false);
  const [assignOpen,          setAssignOpen]         = useState(false);
  const [editingGroup,        setEditingGroup]       = useState(null);
  const [editCourseIds,       setEditCourseIds]      = useState([]);
  const [deleteGroupTarget,   setDeleteGroupTarget]  = useState(null);
  const [deactivateTarget,    setDeactivateTarget]   = useState(null); // instructor user object
  const [editTarget,          setEditTarget]         = useState(null); // instructor user object

  // ── Edit instructor form ──────────────────────────────────────────────────
  const {
    register: regEdit,
    handleSubmit: submitEdit,
    reset: resetEdit,
    formState: { errors: errEdit },
  } = useForm();

  function openEdit(instructor) {
    setEditTarget(instructor);
    resetEdit({ fullName: instructor.fullName, email: instructor.email, password: '' });
  }

  async function onEditSaveInstructor(data) {
    const payload = { id: editTarget._id, fullName: data.fullName, email: data.email };
    if (data.password) payload.password = data.password;
    try {
      await updateInstructor(payload).unwrap();
      toast.success('Instructor updated');
      setEditTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to update instructor');
    }
  }

  // ── Activate / deactivate ─────────────────────────────────────────────────
  async function onActivate(instructor) {
    try {
      await activateUser(instructor._id).unwrap();
      toast.success(`${instructor.fullName} reactivated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to activate');
    }
  }

  async function onDeactivateConfirmed() {
    if (!deactivateTarget) return;
    try {
      await deactivateUser(deactivateTarget._id).unwrap();
      toast.success(`${deactivateTarget.fullName} deactivated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to deactivate');
    } finally {
      setDeactivateTarget(null);
    }
  }

  // ── Group assignments by instructor + class ────────────────────────────────
  const assignmentGroups = useMemo(() => {
    const map = new Map();
    assignments.forEach((a) => {
      const iid = String(a.instructorId?._id ?? a.instructorId);
      const cid = String(a.classId?._id     ?? a.classId);
      const key = `${iid}__${cid}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          instructorId:   iid,
          instructorName: a.instructorId?.fullName ?? '—',
          classId:        cid,
          className:      a.classId?.name ?? '—',
          assignments:    [],
        });
      }
      map.get(key).assignments.push(a);
    });
    return [...map.values()];
  }, [assignments]);

  // ── Register instructor form ───────────────────────────────────────────────
  const {
    register: regReg,
    handleSubmit: submitReg,
    reset: resetReg,
    formState: { errors: errReg },
  } = useForm();

  async function onRegister(data) {
    try {
      await createInstructor(data).unwrap();
      toast.success(`${data.fullName} registered as instructor`);
      setRegisterOpen(false);
      resetReg();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to register instructor');
    }
  }

  // ── Assign instructor form (new assignment) ────────────────────────────────
  const [assignInstructorId, setAssignInstructorId] = useState('');
  const [assignClassId,      setAssignClassId]      = useState('');
  const [assignCourseIds,    setAssignCourseIds]     = useState([]);

  const availableCourses = classes.find((c) => c._id === assignClassId)?.courseIds ?? [];

  function handleClassChange(classId) {
    setAssignClassId(classId);
    setAssignCourseIds([]);
  }

  function toggleAssignCourse(courseId) {
    setAssignCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  }

  function resetAssignForm() {
    setAssignInstructorId('');
    setAssignClassId('');
    setAssignCourseIds([]);
  }

  async function onAssign() {
    if (!assignInstructorId || !assignClassId || assignCourseIds.length === 0) return;
    let successCount = 0;
    const errors = [];
    for (const courseId of assignCourseIds) {
      try {
        await createAssignment({ classId: assignClassId, courseId, instructorId: assignInstructorId }).unwrap();
        successCount++;
      } catch (err) {
        errors.push(err?.data?.error?.message ?? 'Failed');
      }
    }
    if (successCount > 0) {
      await refetchAssignments();
      toast.success(`${successCount} course${successCount > 1 ? 's' : ''} assigned`);
      setAssignOpen(false);
      resetAssignForm();
    }
    if (errors.length > 0) toast.error(errors[0]);
  }

  // ── Edit assignment group ──────────────────────────────────────────────────
  const editAvailableCourses =
    classes.find((c) => c._id === editingGroup?.classId)?.courseIds ?? [];

  function openEditGroup(group) {
    setEditingGroup(group);
    setEditCourseIds(
      group.assignments.map((a) => String(a.courseId?._id ?? a.courseId)),
    );
  }

  function toggleEditCourse(courseId) {
    setEditCourseIds((prev) =>
      prev.includes(courseId) ? prev.filter((id) => id !== courseId) : [...prev, courseId],
    );
  }

  async function onEditSave() {
    if (!editingGroup || editCourseIds.length === 0) return;

    const currentIds = editingGroup.assignments.map((a) => String(a.courseId?._id ?? a.courseId));
    const toRemove   = editingGroup.assignments.filter((a) => !editCourseIds.includes(String(a.courseId?._id ?? a.courseId)));
    const toAdd      = editCourseIds.filter((id) => !currentIds.includes(id));

    const errors = [];

    for (const a of toRemove) {
      try { await deleteAssignment(a._id).unwrap(); }
      catch (err) { errors.push(err?.data?.error?.message ?? 'Failed to remove'); }
    }
    for (const courseId of toAdd) {
      try {
        await createAssignment({
          classId:      editingGroup.classId,
          courseId,
          instructorId: editingGroup.instructorId,
        }).unwrap();
      } catch (err) { errors.push(err?.data?.error?.message ?? 'Failed to add'); }
    }

    await refetchAssignments();
    if (errors.length > 0) {
      toast.error(errors[0]);
    } else {
      toast.success('Assignment updated');
      setEditingGroup(null);
    }
  }

  // ── Delete entire group ────────────────────────────────────────────────────
  async function confirmDeleteGroup() {
    const errors = [];
    for (const a of deleteGroupTarget.assignments) {
      try { await deleteAssignment(a._id).unwrap(); }
      catch (err) { errors.push(err?.data?.error?.message ?? 'Failed'); }
    }
    await refetchAssignments();
    if (errors.length > 0) toast.error(errors[0]);
    else toast.success('Assignment removed');
    setDeleteGroupTarget(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="eyebrow mb-1">Users</p>
        <h2 className="text-ink-900 mb-1">Instructors</h2>
        <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
          Register instructor accounts, then assign each instructor to one or more courses within a class.
        </p>
      </div>

      {/* ── Section 1: Registered instructors ─────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">
            Registered Instructors
          </CardTitle>
          <Button size="sm" onClick={() => { resetReg(); setRegisterOpen(true); }}>
            <UserPlus size={14} />
            Register
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loadingInstructors ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-ink-300" />
            </div>
          ) : instructors.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <UserCheck size={28} className="text-ink-200 mb-2" />
              <p className="text-ink-400 text-sm">No instructors registered yet.</p>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => { resetReg(); setRegisterOpen(true); }}>
                Register first instructor
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="w-28">Assignments</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {instructors.map((u) => {
                  const count    = assignments.filter(
                    (a) => String(a.instructorId?._id ?? a.instructorId) === u._id,
                  ).length;
                  const isActive = u.isActive !== false;
                  const busy     = activating || deactivating;
                  return (
                    <TableRow key={u._id} className={!isActive ? 'opacity-60' : ''}>
                      <TableCell className="font-medium text-ink-800">{u.fullName}</TableCell>
                      <TableCell className="text-ink-500 text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={count > 0 ? 'default' : 'secondary'}>
                          {count} {count === 1 ? 'course' : 'courses'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <Badge variant="success" className="gap-1">
                            <ShieldCheck size={11} /> Active
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <ShieldOff size={11} /> Deactivated
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Edit instructor"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil size={13} />
                          </Button>
                          {isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-danger hover:text-danger hover:bg-danger/10 gap-1"
                              disabled={busy}
                              onClick={() => setDeactivateTarget(u)}
                            >
                              <ShieldOff size={12} /> Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-success hover:text-success hover:bg-success/10 gap-1"
                              disabled={busy}
                              onClick={() => onActivate(u)}
                            >
                              {activating ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                              Activate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Course assignments ──────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm text-ink-500 uppercase tracking-wide font-semibold">
            Course Assignments
          </CardTitle>
          <Button
            size="sm"
            onClick={() => { resetAssignForm(); setAssignOpen(true); }}
            disabled={instructors.length === 0}
            title={instructors.length === 0 ? 'Register an instructor first' : undefined}
          >
            <Plus size={14} />
            Assign
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loadingAssignments ? (
            <div className="flex justify-center py-8">
              <Loader2 size={18} className="animate-spin text-ink-300" />
            </div>
          ) : assignmentGroups.length === 0 ? (
            <p className="text-center text-ink-400 text-sm py-10">
              No assignments yet. Register an instructor and assign them to a course.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Courses</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignmentGroups.map((group) => {
                  const instructor   = instructors.find((u) => u._id === group.instructorId);
                  const isInactive   = instructor && instructor.isActive === false;
                  return (
                  <TableRow key={group.key}>
                    <TableCell className="font-medium text-ink-800">
                      <span className="flex items-center gap-1.5">
                        {group.instructorName}
                        {isInactive && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 uppercase tracking-wide">
                            <AlertTriangle size={9} /> Deactivated
                          </span>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-ink-700">{group.className}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {group.assignments.map((a) => (
                          <span
                            key={a._id}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs bg-ink-100 text-ink-700"
                          >
                            {a.courseId?.code && (
                              <span className="font-mono text-ink-400">{a.courseId.code}</span>
                            )}
                            {a.courseId?.name ?? '—'}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          onClick={() => openEditGroup(group)}
                          aria-label="Edit assignment"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 hover:text-danger"
                          onClick={() => setDeleteGroupTarget(group)}
                          aria-label="Remove assignment"
                        >
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
        </CardContent>
      </Card>

      {/* ── Register instructor dialog ────────────────────────────────────── */}
      <Dialog open={registerOpen} onOpenChange={(v) => { if (!v) { setRegisterOpen(false); resetReg(); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Register Instructor</DialogTitle>
            <DialogDescription>
              Create a new instructor account. They will log in with their email and this password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitReg(onRegister)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="r-name">Full Name <span className="text-danger">*</span></Label>
              <Input
                id="r-name"
                placeholder="e.g. Dr. Amina Hassan"
                {...regReg('fullName', { required: 'Required', minLength: { value: 2, message: 'At least 2 characters' } })}
                aria-invalid={!!errReg.fullName}
              />
              {errReg.fullName && <p className="text-xs text-danger">{errReg.fullName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-email">Email <span className="text-danger">*</span></Label>
              <Input
                id="r-email"
                type="email"
                placeholder="instructor@university.edu"
                {...regReg('email', {
                  required: 'Required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
                })}
                aria-invalid={!!errReg.email}
              />
              {errReg.email && <p className="text-xs text-danger">{errReg.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-pw">Password <span className="text-danger">*</span></Label>
              <Input
                id="r-pw"
                type="password"
                placeholder="Min 6 characters"
                {...regReg('password', { required: 'Required', minLength: { value: 6, message: 'At least 6 characters' } })}
                aria-invalid={!!errReg.password}
              />
              {errReg.password && <p className="text-xs text-danger">{errReg.password.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={registering}>
                {registering && <Loader2 size={14} className="animate-spin" />}
                Register
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Assign instructor dialog (new) ────────────────────────────────── */}
      <Dialog open={assignOpen} onOpenChange={(v) => { if (!v) { setAssignOpen(false); resetAssignForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Instructor</DialogTitle>
            <DialogDescription>
              Select an instructor and a class, then pick one or more courses from that class.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Instructor <span className="text-danger">*</span></Label>
              <Select value={assignInstructorId} onValueChange={setAssignInstructorId}>
                <SelectTrigger><SelectValue placeholder="Select instructor…" /></SelectTrigger>
                <SelectContent>
                  {instructors.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.fullName}
                      <span className="ml-1.5 text-xs text-ink-400">{u.email}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Class <span className="text-danger">*</span></Label>
              <Select value={assignClassId} onValueChange={handleClassChange}>
                <SelectTrigger><SelectValue placeholder="Select class…" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Courses <span className="text-danger">*</span>
                {assignCourseIds.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-ink-400">
                    {assignCourseIds.length} selected
                  </span>
                )}
              </Label>
              {!assignClassId ? (
                <p className="text-sm text-ink-400 rounded-md border border-border bg-ink-50 px-3 py-2">
                  Select a class first to see its courses.
                </p>
              ) : availableCourses.length === 0 ? (
                <p className="text-sm text-ink-400 rounded-md border border-border bg-ink-50 px-3 py-2">
                  This class has no courses. Add courses to the class first.
                </p>
              ) : (
                <div className="rounded-md border border-border max-h-44 overflow-y-auto divide-y divide-border">
                  {availableCourses.map((c) => {
                    const cid     = String(c._id ?? c);
                    const checked = assignCourseIds.includes(cid);
                    return (
                      <label key={cid} className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssignCourse(cid)}
                          className="h-4 w-4 rounded border-border accent-just-blue-600"
                        />
                        {c.code && <span className="font-mono text-xs text-ink-400 shrink-0">{c.code}</span>}
                        <span className="text-sm text-ink-800">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setAssignOpen(false); resetAssignForm(); }}>Cancel</Button>
            <Button
              onClick={onAssign}
              disabled={!assignInstructorId || !assignClassId || assignCourseIds.length === 0 || assigning}
            >
              {assigning && <Loader2 size={14} className="animate-spin" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit assignment group dialog ──────────────────────────────────── */}
      <Dialog open={!!editingGroup} onOpenChange={(v) => !v && setEditingGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Assignment</DialogTitle>
            <DialogDescription>
              Change the courses assigned to this instructor in this class.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Read-only context */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-ink-500">Instructor</p>
                <p className="text-sm font-semibold text-ink-800">{editingGroup?.instructorName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-ink-500">Class</p>
                <p className="text-sm font-semibold text-ink-800">{editingGroup?.className}</p>
              </div>
            </div>

            {/* Course multi-select */}
            <div className="space-y-1.5">
              <Label>
                Courses <span className="text-danger">*</span>
                {editCourseIds.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-ink-400">
                    {editCourseIds.length} selected
                  </span>
                )}
              </Label>
              {editAvailableCourses.length === 0 ? (
                <p className="text-sm text-ink-400 rounded-md border border-border bg-ink-50 px-3 py-2">
                  No courses found for this class.
                </p>
              ) : (
                <div className="rounded-md border border-border max-h-44 overflow-y-auto divide-y divide-border">
                  {editAvailableCourses.map((c) => {
                    const cid     = String(c._id ?? c);
                    const checked = editCourseIds.includes(cid);
                    return (
                      <label key={cid} className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEditCourse(cid)}
                          className="h-4 w-4 rounded border-border accent-just-blue-600"
                        />
                        {c.code && <span className="font-mono text-xs text-ink-400 shrink-0">{c.code}</span>}
                        <span className="text-sm text-ink-800">{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setEditingGroup(null)}>Cancel</Button>
            <Button
              onClick={onEditSave}
              disabled={editCourseIds.length === 0 || deleting || assigning}
            >
              {(deleting || assigning) && <Loader2 size={14} className="animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit instructor dialog ───────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Instructor</DialogTitle>
            <DialogDescription>
              Update name, email, or set a new password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit(onEditSaveInstructor)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="e-name">Full Name <span className="text-danger">*</span></Label>
              <Input
                id="e-name"
                {...regEdit('fullName', { required: 'Required', minLength: { value: 2, message: 'At least 2 characters' } })}
                aria-invalid={!!errEdit.fullName}
              />
              {errEdit.fullName && <p className="text-xs text-danger">{errEdit.fullName.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-email">Email <span className="text-danger">*</span></Label>
              <Input
                id="e-email"
                type="email"
                {...regEdit('email', {
                  required: 'Required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
                })}
                aria-invalid={!!errEdit.email}
              />
              {errEdit.email && <p className="text-xs text-danger">{errEdit.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-pw">
                New Password
                <span className="ml-1.5 text-xs font-normal text-ink-400">(leave blank to keep current)</span>
              </Label>
              <Input
                id="e-pw"
                type="password"
                placeholder="Min 6 characters"
                {...regEdit('password', {
                  minLength: { value: 6, message: 'At least 6 characters' },
                })}
                aria-invalid={!!errEdit.password}
              />
              {errEdit.password && <p className="text-xs text-danger">{errEdit.password.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={updating}>
                {updating && <Loader2 size={14} className="animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Deactivate instructor confirm ─────────────────────────────────── */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={(v) => !v && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Instructor</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-ink-800">{deactivateTarget?.fullName}</span> will
              no longer be able to log in. Their course assignments and data are kept — reactivating
              them will restore full access immediately. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={onDeactivateConfirmed}
              disabled={deactivating}
            >
              {deactivating && <Loader2 size={14} className="animate-spin" />}
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete group confirm ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteGroupTarget} onOpenChange={(v) => !v && setDeleteGroupTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Assignment</AlertDialogTitle>
            <AlertDialogDescription>
              Remove all course assignments for{' '}
              <span className="font-semibold text-ink-800">{deleteGroupTarget?.instructorName}</span>
              {' '}in{' '}
              <span className="font-semibold text-ink-800">{deleteGroupTarget?.className}</span>?
              They will lose access to this class.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGroup} disabled={deleting}>
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
