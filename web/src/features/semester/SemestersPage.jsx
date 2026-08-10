import { useState, useEffect } from 'react';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetSemestersQuery,
  useCreateSemesterMutation,
  useUpdateSemesterMutation,
  useDeleteSemesterMutation,
} from './semesterApi';
import { useGetAcademicYearsQuery } from '@/features/academicYear/academicYearApi';
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

const STATUS_VARIANT = { active: 'success', completed: 'default', archived: 'secondary' };
const ALL = '__all__';

// Mirrors backend/src/modules/semester/services/semesterRules.js — kept in
// sync by hand (no shared package between web/backend in this monorepo).
// The backend is the source of truth; this is purely for immediate UI
// feedback before the round-trip.
const MIN_SEMESTER_MONTHS    = 4;
const MAX_SEMESTER_MONTHS    = 6;
const MAX_SEMESTERS_PER_YEAR = 12;
const SEMESTER_NAME_PATTERN  = /^Semester (\d+)$/i;

// Adds `months` calendar months, clamping day-of-month overflow to the last
// day of the target month (e.g. Jan 31 + 1 month -> Feb 28, not Mar 3).
function addMonthsUTC(date, months) {
  const d = new Date(date);
  const year  = d.getUTCFullYear();
  const month = d.getUTCMonth() + months;
  const day   = d.getUTCDate();
  const result = new Date(Date.UTC(year, month, day));
  const expectedMonth = ((month % 12) + 12) % 12;
  if (result.getUTCMonth() !== expectedMonth) result.setUTCDate(0);
  return result;
}

// Next unused "Semester N" (1-12) among `existing` — null once all 12 are taken.
function nextSemesterName(existing) {
  const used = new Set();
  for (const s of existing) {
    const match = SEMESTER_NAME_PATTERN.exec(String(s.name ?? '').trim());
    if (match) used.add(Number(match[1]));
  }
  for (let n = 1; n <= MAX_SEMESTERS_PER_YEAR; n++) {
    if (!used.has(n)) return `Semester ${n}`;
  }
  return null;
}

export default function SemestersPage() {
  const { data: semesters    = [], isLoading, error } = useGetSemestersQuery();
  const { data: academicYears = [] }                   = useGetAcademicYearsQuery();
  const [createSemester, { isLoading: creating }] = useCreateSemesterMutation();
  const [updateSemester, { isLoading: updating }] = useUpdateSemesterMutation();
  const [deleteSemester, { isLoading: deleting }] = useDeleteSemesterMutation();

  const [statusFilter, setStatusFilter] = useState(ALL);
  const [dialogOpen, setDialogOpen]     = useState(false);
  const [editing, setEditing]           = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { register, handleSubmit, reset, control, getValues, formState: { errors } } = useForm();

  const ayMap = Object.fromEntries(academicYears.map((y) => [y._id, y.name]));

  const visible = statusFilter === ALL
    ? semesters
    : semesters.filter((s) => s.status === statusFilter);

  useEffect(() => {
    reset(editing ? {
      academicYearId: String(editing.academicYearId?._id ?? editing.academicYearId ?? ''),
      startDate:      toDateInput(editing.startDate),
      endDate:        toDateInput(editing.endDate),
      status:         editing.status,
    } : {
      academicYearId: '', startDate: '', endDate: '', status: 'active',
    });
  }, [editing, reset]);

  // Other active semesters in the selected academic year (excluding the one
  // being edited) — drives both the auto-name preview and the client-side
  // overlap check below.
  const watchedAcademicYearId = useWatch({ control, name: 'academicYearId' });
  const siblingsInAY = semesters.filter((s) => {
    const sAyId = String(s.academicYearId?._id ?? s.academicYearId ?? '');
    if (sAyId !== watchedAcademicYearId) return false;
    if (editing && String(s._id) === String(editing._id)) return false;
    return true;
  });
  const selectedAY = academicYears.find((y) => y._id === watchedAcademicYearId);
  const computedName = editing
    ? editing.name
    : (watchedAcademicYearId ? nextSemesterName(siblingsInAY) : '');
  const isFull = !editing && !!watchedAcademicYearId && computedName === null;

  function openCreate() { setEditing(null); setDialogOpen(true); }
  function openEdit(s)  { setEditing(s);    setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditing(null); }

  async function onSubmit(data) {
    try {
      if (editing) {
        await updateSemester({ id: editing._id, ...data }).unwrap();
        toast.success('Semester updated');
      } else {
        await createSemester(data).unwrap();
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
            Time periods belonging to an academic year. Semesters scope course offerings.
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 ml-4">
          <Plus size={16} /> New Semester
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-ink-500 font-medium">Filter by status</span>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load semesters.'}</p>
        ) : isLoading ? (
          <div className="flex justify-center p-12"><Loader2 size={20} className="animate-spin text-ink-300" /></div>
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
                <TableHead>Academic Year</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((s) => {
                const ayId = String(s.academicYearId?._id ?? s.academicYearId ?? '');
                return (
                  <TableRow key={s._id}>
                    <TableCell className="font-medium text-ink-800">{s.name}</TableCell>
                    <TableCell className="text-ink-500">
                      {s.academicYearId?.name ?? ayMap[ayId] ?? '—'}
                    </TableCell>
                    <TableCell className="text-ink-500 whitespace-nowrap">
                      {fmtDate(s.startDate)} – {fmtDate(s.endDate)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[s.status] ?? 'secondary'}>{s.status}</Badge>
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
                );
              })}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Name</Label>
                <Input
                  id="s-name"
                  disabled
                  readOnly
                  value={computedName || ''}
                  placeholder={editing ? '' : 'Select an academic year first'}
                />
                {isFull && (
                  <p className="text-xs text-danger">
                    This academic year already has the maximum of {MAX_SEMESTERS_PER_YEAR} semesters.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Academic Year <span className="text-danger">*</span></Label>
                <Controller
                  control={control}
                  name="academicYearId"
                  rules={{ required: 'Academic year is required' }}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-invalid={!!errors.academicYearId}>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        {academicYears.map((y) => (
                          <SelectItem key={y._id} value={y._id}>{y.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.academicYearId && <p className="text-xs text-danger">{errors.academicYearId.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="s-start">Start date <span className="text-danger">*</span></Label>
                <Input id="s-start" type="date" {...register('startDate', { required: 'Required' })} aria-invalid={!!errors.startDate} />
                {errors.startDate && <p className="text-xs text-danger">{errors.startDate.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-end">End date <span className="text-danger">*</span></Label>
                <Input
                  id="s-end"
                  type="date"
                  {...register('endDate', {
                    required: 'Required',
                    validate: (endVal) => {
                      const startVal = getValues('startDate');
                      if (!startVal || !endVal) return true;
                      const start = new Date(startVal);
                      const end   = new Date(endVal);
                      if (start >= end) return 'End date must be after start date';

                      const minEnd = addMonthsUTC(start, MIN_SEMESTER_MONTHS);
                      const maxEnd = addMonthsUTC(start, MAX_SEMESTER_MONTHS);
                      if (end < minEnd) return `A semester must be at least ${MIN_SEMESTER_MONTHS} months long`;
                      if (end > maxEnd) return `A semester must be at most ${MAX_SEMESTER_MONTHS} months long`;

                      if (selectedAY) {
                        const ayStart = new Date(selectedAY.startDate);
                        const ayEnd   = new Date(selectedAY.endDate);
                        if (start < ayStart || end > ayEnd) {
                          return `Dates must fall within the academic year (${fmtDate(selectedAY.startDate)} – ${fmtDate(selectedAY.endDate)})`;
                        }
                      }

                      const overlap = siblingsInAY.find((s) => {
                        const sStart = new Date(s.startDate);
                        const sEnd   = new Date(s.endDate);
                        return start < sEnd && end > sStart;
                      });
                      if (overlap) {
                        return `Dates overlap with "${overlap.name}" (${fmtDate(overlap.startDate)} – ${fmtDate(overlap.endDate)})`;
                      }

                      return true;
                    },
                  })}
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
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={creating || updating || isFull}>
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
              Delete <span className="font-semibold text-ink-800">{deleteTarget?.name}</span>?
              Course offerings in this semester must be removed first.
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
