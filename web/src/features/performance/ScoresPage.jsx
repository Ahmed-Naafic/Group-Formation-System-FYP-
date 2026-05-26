import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Loader2, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useGetStudentsQuery } from '@/features/student/studentApi';
import { useGetClassByIdQuery } from '@/features/class/classApi';
import {
  useRecalculateClassMutation,
  useUpdateAttendanceMutation,
  useUpdateScoresMutation,
} from './performanceApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

// ── Per-row inline editing ────────────────────────────────────────────────────

function ScoreRow({ student }) {
  const [updateScores,     { isLoading: savingScores }] = useUpdateScoresMutation();
  const [updateAttendance, { isLoading: savingAtt }]    = useUpdateAttendanceMutation();
  const saving = savingScores || savingAtt;

  const { register, handleSubmit, formState: { isDirty } } = useForm({
    values: {
      attendance:   student.attendance ?? 0,
      averageScore: student.averageScore ?? '',
    },
  });

  async function onSave(data) {
    try {
      const averageScore = data.averageScore !== '' ? Number(data.averageScore) : null;

      if (averageScore !== null) {
        await updateScores({ studentId: student._id, averageScore }).unwrap();
      }
      await updateAttendance({ studentId: student._id, attendance: Number(data.attendance) || 0 }).unwrap();
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
        <Input
          type="number" min={0} max={100}
          className="h-7 w-16 text-xs"
          {...register('attendance')}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number" min={0} max={100} step="0.01" placeholder="—"
          className="h-7 w-24 text-xs"
          {...register('averageScore')}
        />
      </TableCell>
      <TableCell>
        <Badge variant={CATEGORY_VARIANT[student.performanceCategory] ?? 'secondary'}>
          {student.performanceCategory ?? 'UNGRADED'}
        </Badge>
      </TableCell>
      <TableCell className="w-24">
        {isDirty && (
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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ScoresPage() {
  const { classId } = useParams();
  const { data: cls, isLoading: loadingClass } = useGetClassByIdQuery(classId);
  const { data: students = [], isLoading, error } = useGetStudentsQuery(classId);
  const [recalculate, { isLoading: recalculating }] = useRecalculateClassMutation();

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
          <h2 className="text-ink-900 mb-1">Grades & Attendance</h2>
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
          {recalculating
            ? <Loader2 size={15} className="animate-spin" />
            : <RefreshCw size={15} />}
          Recalculate All
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs overflow-x-auto">
        {error ? (
          <p className="p-6 text-sm text-danger">
            {error?.data?.error?.message ?? 'Failed to load students.'}
          </p>
        ) : isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
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
                <TableHead className="w-20">Attend %</TableHead>
                <TableHead className="w-28">Avg Score</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <ScoreRow key={s._id} student={s} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
