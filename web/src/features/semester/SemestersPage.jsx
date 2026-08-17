import { useState } from 'react';
import { useGetSemestersQuery } from './semesterApi';
import { useGetAcademicYearsQuery } from '@/features/academicYear/academicYearApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

const GROUP_LABEL = { FIRST: 'First six months', SECOND: 'Second six months' };
const GROUP_VARIANT = { FIRST: 'default', SECOND: 'secondary' };
const ALL = '__all__';

// Semesters are entirely system-managed: every academic year automatically
// gets exactly 10 (numbered 1-10, split into two fixed six-month groups) the
// moment it's created — there is no admin create/edit/delete for them here.
export default function SemestersPage() {
  const [academicYearFilter, setAcademicYearFilter] = useState(ALL);

  const { data: academicYears = [] } = useGetAcademicYearsQuery();
  const { data: semesters = [], isLoading, error } = useGetSemestersQuery(
    academicYearFilter === ALL ? undefined : { academicYearId: academicYearFilter },
  );

  const ayMap = Object.fromEntries(academicYears.map((y) => [y._id, y.name]));

  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow mb-1">Academic Structure</p>
        <h2 className="text-ink-900 mb-1">Semesters</h2>
        <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
          Every academic year automatically has 10 Course Offering semesters, split into two
          six-month groups (1, 3, 5, 7, 9 and 2, 4, 6, 8, 10). These are system-managed — Course
          Offerings select from them, but they can't be created, edited, or deleted here.
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-xs text-ink-500 font-medium">Filter by academic year</span>
        <Select value={academicYearFilter} onValueChange={setAcademicYearFilter}>
          <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All academic years</SelectItem>
            {academicYears.map((y) => (
              <SelectItem key={y._id} value={y._id}>{y.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-xs">
        {error ? (
          <p className="p-6 text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load semesters.'}</p>
        ) : isLoading ? (
          <div className="flex justify-center p-12"><Loader2 size={20} className="animate-spin text-ink-300" /></div>
        ) : semesters.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <p className="text-ink-400 text-sm">No semesters yet — they're created automatically with each academic year.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Academic Year</TableHead>
                <TableHead>Six-Month Group</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {semesters.map((s) => {
                const ayId = String(s.academicYearId?._id ?? s.academicYearId ?? '');
                const group = s.sixMonthGroup;
                return (
                  <TableRow key={s._id}>
                    <TableCell className="font-medium text-ink-800">{s.name}</TableCell>
                    <TableCell className="text-ink-500">{s.academicYearId?.name ?? ayMap[ayId] ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={GROUP_VARIANT[group] ?? 'secondary'}>{GROUP_LABEL[group] ?? group}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
