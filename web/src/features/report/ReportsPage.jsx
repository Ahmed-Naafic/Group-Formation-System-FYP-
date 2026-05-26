import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Loader2, FileSpreadsheet, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useGetClassesQuery, useGetClassByIdQuery } from '@/features/class/classApi';
import { useGetCourseAssignmentsQuery } from '@/features/courseAssignment/courseAssignmentApi';
import { selectRole, selectCurrentToken } from '@/features/auth/authSlice';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

export default function ReportsPage() {
  const role    = useSelector(selectRole);
  const token   = useSelector(selectCurrentToken);
  const isAdmin = role === 'admin';

  const [selectedClassId,  setSelectedClassId]  = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [downloading,      setDownloading]      = useState(null); // 'xlsx' | 'csv' | null

  const { data: allClasses = [] }  = useGetClassesQuery(undefined, { skip: !isAdmin });
  const { data: assignments = [] } = useGetCourseAssignmentsQuery(undefined, { skip: isAdmin });
  const { data: selectedClass, isLoading: loadingCourses } = useGetClassByIdQuery(
    selectedClassId, { skip: !selectedClassId || !isAdmin },
  );

  // ── Class list ─────────────────────────────────────────────────────────────

  const classList = isAdmin
    ? allClasses
    : [...new Map(
        assignments.map((a) => {
          const cls = a.classId;
          return [String(cls?._id ?? cls), { _id: String(cls?._id ?? cls), name: cls?.name ?? '' }];
        }),
      ).values()];

  // ── Course list for selected class ─────────────────────────────────────────

  const courseList = isAdmin
    ? (selectedClass?.courseIds ?? []).map((c) => ({
        _id: String(c._id ?? c), name: c.name ?? '', code: c.code ?? '',
      }))
    : assignments
        .filter((a) => String(a.classId?._id ?? a.classId) === selectedClassId)
        .map((a) => {
          const c = a.courseId;
          return { _id: String(c?._id ?? c), name: c?.name ?? '', code: c?.code ?? '' };
        });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleClassChange(val) {
    setSelectedClassId(val);
    setSelectedCourseId('');
  }

  async function download(format) {
    setDownloading(format);
    try {
      const url = `${API_BASE}/api/reports/groups?classId=${selectedClassId}&courseId=${selectedCourseId}&format=${format}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Download failed');
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href  = URL.createObjectURL(blob);
      link.download = `groups.${format}`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.error(err.message ?? 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  const canDownload = !!(selectedClassId && selectedCourseId);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg">
      <h2 className="text-ink-900 mb-6">Reports</h2>

      <div className="space-y-5">
        {/* Class selector */}
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={selectedClassId} onValueChange={handleClassChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select a class…" />
            </SelectTrigger>
            <SelectContent>
              {classList.map((cls) => (
                <SelectItem key={cls._id ?? cls.id} value={String(cls._id ?? cls.id)}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Course selector */}
        <div className="space-y-1.5">
          <Label>Course</Label>
          <Select
            value={selectedCourseId}
            onValueChange={setSelectedCourseId}
            disabled={!selectedClassId || loadingCourses || courseList.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                !selectedClassId   ? 'Select a class first'
                : loadingCourses   ? 'Loading courses…'
                : courseList.length === 0 ? 'No courses found'
                : 'Select a course…'
              } />
            </SelectTrigger>
            <SelectContent>
              {courseList.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                  {c.code && (
                    <span className="ml-1.5 font-mono text-xs text-ink-400">{c.code}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Download card */}
        <div className="rounded-lg border border-border bg-white shadow-xs p-5">
          <p className="text-sm font-medium text-ink-800 mb-1">Group Formation Report</p>
          <p className="text-xs text-ink-400 mb-4">
            Exports groups summary and full student roster with performance data.
            XLSX includes two sheets; CSV is a flat student list.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => download('xlsx')}
              disabled={!canDownload || !!downloading}
            >
              {downloading === 'xlsx'
                ? <Loader2 size={14} className="animate-spin" />
                : <FileSpreadsheet size={14} />}
              Download XLSX
            </Button>
            <Button
              variant="outline"
              onClick={() => download('csv')}
              disabled={!canDownload || !!downloading}
            >
              {downloading === 'csv'
                ? <Loader2 size={14} className="animate-spin" />
                : <FileText size={14} />}
              Download CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
