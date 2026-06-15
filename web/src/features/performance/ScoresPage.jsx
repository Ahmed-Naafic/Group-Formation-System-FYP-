import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useForm } from 'react-hook-form';
import { Loader2, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { selectRole } from '@/features/auth/authSlice';
import { useGetStudentsQuery } from '@/features/student/studentApi';
import { useGetClassByIdQuery } from '@/features/class/classApi';
import {
  useRecalculateCohortMutation,
  useUpdateScoresMutation,
} from './performanceApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

// NOTE: Attendance column removed — Student.attendance was removed in Step 5 of the
// cohort refactor. Attendance is now per-offering in the Attendance table.
// Full page migration to cohortId happens in Step 9.

function ScoreRow({ student, isAdmin }) {
  const [updateScores, { isLoading: saving }] = useUpdateScoresMutation();

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    values: { averageScore: student.averageScore ?? '' },
  });

  async function onSave(data) {
    try {
      if (isAdmin) {
        const averageScore = data.averageScore !== '' ? Number(data.averageScore) : null;
        await updateScores({ studentId: student._id, averageScore }).unwrap();
      }
      toast.success(`${student.fullName} saved`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to save');
    }
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs text-ink-500">{student.userId?.studentId ?? '—'}</TableCell>
      <TableCell className="font-medium text-ink-800">{student.fullName}</TableCell>
      <TableCell>
        {isAdmin ? (
          <Input
            type="number" min={0} max={100} step="0.01" placeholder="—"
            className="h-7 w-24 text-xs"
            {...register('averageScore')}
          />
        ) : (
          <span className="text-sm text-ink-500 tabular-nums">
            {student.averageScore ?? <span className="text-ink-300">—</span>}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={CATEGORY_VARIANT[student.performanceCategory] ?? 'secondary'}>
          {student.performanceCategory ?? 'UNGRADED'}
        </Badge>
      </TableCell>
      <TableCell className="w-24">
        {isDirty && isAdmin && (
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleSubmit(onSave)}
            disabled={saving}
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Save
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function ScoresPage() {
  const { classId } = useParams();
  const isAdmin = useSelector(selectRole) === 'admin';
  const { data: cls, isLoading: loadingClass } = useGetClassByIdQuery(classId);
  const { data: students = [], isLoading, error } = useGetStudentsQuery(classId);
  const [recalculate, { isLoading: recalculating }] = useRecalculateCohortMutation();

  const className = cls?.name ?? (loadingClass ? '…' : 'Class');

  async function handleRecalculate() {
    try {
      const result = await recalculate(classId).unwrap();
      toast.success(`Recalculated ${result.updated} student${result.updated !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Recalculation failed');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">
            <Link to="/classes" className="hover:underline">Classes</Link>
            {' / '}
            <Link to={`/classes/${classId}/students`} className="hover:underline">{className}</Link>
            {' / '}
            Grades
          </p>
          <h2 className="text-ink-900 mb-1">Grades</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            Edit inline and save each row. Saving a score auto-recalculates the performance category.
          </p>
        </div>
        <Button
          variant="outline"
          className="ml-4 shrink-0"
          onClick={handleRecalculate}
          disabled={recalculating || students.length === 0}
        >
          {recalculating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Recalculate All
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs overflow-x-auto">
        {error ? (
          <p className="p-6 text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load students.'}</p>
        ) : isLoading ? (
          <div className="flex justify-center p-12"><Loader2 size={20} className="animate-spin text-ink-300" /></div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm">
              No students in this class yet.{' '}
              <Link to={`/classes/${classId}/students`} className="text-just-blue-600 hover:underline">
                Add students first.
              </Link>
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-28">
                  Avg Score{!isAdmin && <span className="ml-1 text-ink-300 font-normal text-[10px]">(read-only)</span>}
                </TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <ScoreRow key={s._id} student={s} isAdmin={isAdmin} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
