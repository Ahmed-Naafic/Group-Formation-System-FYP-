import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Save, Users2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGetStudentsQuery } from '@/features/student/studentApi';
import { useGetCourseOfferingByIdQuery } from '@/features/courseOffering/courseOfferingApi';
import { useGetAttendanceQuery, useBulkUpsertAttendanceMutation } from './attendanceApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AttendancePage() {
  const { offeringId } = useParams();

  const { data: offering,  isLoading: loadingOff  } = useGetCourseOfferingByIdQuery(offeringId);
  const cohortId = String(offering?.cohortId?._id ?? offering?.cohortId ?? '');

  const { data: students   = [], isLoading: loadingStu } = useGetStudentsQuery(cohortId, { skip: !cohortId });
  const { data: records    = [], isLoading: loadingAtt } = useGetAttendanceQuery(offeringId);
  const [bulkUpsert, { isLoading: saving }] = useBulkUpsertAttendanceMutation();

  // local editable map: studentId → percentage string
  const [values, setValues] = useState({});

  // Seed local values once data arrives
  useEffect(() => {
    if (!students.length) return;
    const map = {};
    students.forEach((s) => { map[s._id] = ''; });
    records.forEach((r) => {
      const sid = String(r.studentId?._id ?? r.studentId);
      map[sid] = String(r.percentage ?? '');
    });
    setValues(map);
  }, [students, records]);

  const isLoading = loadingOff || loadingStu || loadingAtt;

  const offeringLabel = offering
    ? `${offering.courseId?.name ?? '—'} — ${offering.cohortId?.name ?? '—'}`
    : '…';

  async function handleSaveAll() {
    const recordsPayload = students
      .map((s) => ({
        studentId:  s._id,
        percentage: parseFloat(values[s._id] ?? '') || 0,
      }))
      .filter((r) => r.percentage >= 0);

    if (!recordsPayload.length) {
      toast.error('No students to save');
      return;
    }

    try {
      const result = await bulkUpsert({ courseOfferingId: offeringId, records: recordsPayload }).unwrap();
      toast.success(`Saved: ${result.created?.length ?? 0} created, ${result.updated?.length ?? 0} updated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to save attendance');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">
            <Link to="/course-offerings" className="hover:underline">Course Offerings</Link>
            {' / '}
            {offeringLabel}
          </p>
          <h2 className="text-ink-900 mb-1">Attendance</h2>
          <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
            Enter each student's attendance percentage (0–100). Used by the group formation algorithm to filter absent students.
          </p>
        </div>
        <Button onClick={handleSaveAll} disabled={saving || isLoading}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save All
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
        ) : students.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Users2 size={32} className="text-ink-200 mb-3" />
            <p className="text-ink-400 text-sm">No students in this cohort yet.</p>
            <Link
              to={`/cohorts/${cohortId}/students`}
              className="text-sm text-just-blue-600 hover:underline mt-1"
            >
              Add students first
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-40">Attendance %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s._id}>
                  <TableCell className="font-mono text-xs text-ink-500">
                    {s.userId?.studentId ?? '—'}
                  </TableCell>
                  <TableCell className="font-medium text-ink-800">{s.fullName}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      placeholder="0"
                      value={values[s._id] ?? ''}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [s._id]: e.target.value }))
                      }
                      className="h-7 w-24 text-xs"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
