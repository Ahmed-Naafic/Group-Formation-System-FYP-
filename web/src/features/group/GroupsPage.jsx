import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import {
  Loader2, RefreshCw, Crown, AlertTriangle, ArrowRight, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSelector } from 'react-redux';
import {
  useGetGroupsQuery,
  useGenerateGroupsMutation,
  useRegenerateGroupsMutation,
} from './groupApi';
import { useGetClassByIdQuery } from '@/features/class/classApi';
import { useGetCourseAssignmentsQuery } from '@/features/courseAssignment/courseAssignmentApi';
import { selectRole } from '@/features/auth/authSlice';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

const BALANCE_CONFIG = [
  { key: 'HIGH',     color: 'text-success',       bg: 'bg-success/10' },
  { key: 'MEDIUM',   color: 'text-just-blue-700', bg: 'bg-just-blue-50' },
  { key: 'LOW',      color: 'text-danger',         bg: 'bg-danger/10' },
  { key: 'UNGRADED', color: 'text-ink-400',        bg: 'bg-ink-100' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function SizeButtons({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[3, 4, 5, 6].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            'w-10 h-10 rounded-md border text-sm font-semibold transition-colors',
            Number(value) === n
              ? 'border-just-blue-600 bg-just-blue-600 text-white'
              : 'border-border text-ink-600 hover:border-just-blue-400 hover:text-ink-900',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function GenerateFields({ control, register }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Group size</Label>
        <Controller
          control={control}
          name="groupSize"
          render={({ field }) => (
            <SizeButtons value={field.value} onChange={field.onChange} />
          )}
        />
        <p className="text-xs text-ink-400">Students per group (last group may be smaller).</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="att-thr">Attendance threshold %</Label>
        <Input
          id="att-thr"
          type="number"
          min={0}
          max={100}
          className="w-28"
          {...register('attendanceThreshold', { min: 0, max: 100 })}
        />
        <p className="text-xs text-ink-400">
          Students below this attendance are placed last in formation.
        </p>
      </div>
    </div>
  );
}

function BalanceSummary({ groups }) {
  const counts = useMemo(() => {
    const c = { HIGH: 0, MEDIUM: 0, LOW: 0, UNGRADED: 0 };
    groups.forEach((g) => g.memberIds?.forEach((m) => {
      const cat = m.performanceCategory ?? 'UNGRADED';
      c[cat] = (c[cat] || 0) + 1;
    }));
    return c;
  }, [groups]);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-lg border border-border bg-white shadow-xs p-4">
      <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">
        Performance Distribution — {total} students across {groups.length} groups
      </p>
      <div className="grid grid-cols-4 gap-3">
        {BALANCE_CONFIG.map(({ key, color, bg }) => (
          <div key={key} className={cn('rounded-md px-3 py-2.5 text-center', bg)}>
            <p className={cn('text-2xl font-bold leading-none', color)}>{counts[key]}</p>
            <p className={cn('text-[11px] font-semibold mt-1 uppercase tracking-wide', color)}>
              {key === 'UNGRADED' ? 'Ungraded' : key}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupCard({ group, onAdjust }) {
  const leaderId = String(group.leaderId?._id ?? group.leaderId);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-ink-800">{group.name}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1 text-just-blue-600 hover:text-just-blue-700 -mr-1"
            onClick={onAdjust}
          >
            Adjust <ArrowRight size={11} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        <div className="divide-y divide-border">
          {group.memberIds?.map((m) => {
            const isLeader = String(m._id) === leaderId;
            return (
              <div key={m._id} className="flex items-center gap-2 py-2 text-sm">
                <span className="w-4 shrink-0 flex items-center">
                  {isLeader && (
                    <Crown size={12} style={{ color: 'var(--just-gold-400)' }} />
                  )}
                </span>
                <span className="flex-1 font-medium text-ink-800 truncate min-w-0">
                  {m.fullName}
                </span>
                <span className="font-mono text-[11px] text-ink-400 shrink-0">
                  {m.userId?.studentId ?? '—'}
                </span>
                <Badge
                  variant={CATEGORY_VARIANT[m.performanceCategory] ?? 'secondary'}
                  className="shrink-0 text-[10px] px-1.5 py-0 h-4"
                >
                  {m.performanceCategory ?? 'UNG'}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function GroupsPage() {
  const { classId } = useParams();
  const navigate    = useNavigate();
  const role        = useSelector(selectRole);
  const isAdmin     = role === 'admin';

  const { data: cls, isLoading: loadingClass }                    = useGetClassByIdQuery(classId);
  const { data: assignments = [], isLoading: loadingAssignments } = useGetCourseAssignmentsQuery(
    undefined, { skip: isAdmin },
  );

  // Courses for this class — normalized to { _id, name, code }
  const classCourses = useMemo(() => {
    if (isAdmin) {
      return (cls?.courseIds ?? []).map((c) => ({
        _id:  String(c._id ?? c),
        name: c.name  ?? '',
        code: c.code  ?? '',
      }));
    }
    return assignments
      .filter((a) => String(a.classId?._id ?? a.classId) === classId)
      .map((a) => {
        const c = a.courseId;
        return { _id: String(c?._id ?? c), name: c?.name ?? '', code: c?.code ?? '' };
      });
  }, [isAdmin, cls, assignments, classId]);

  const [selectedCourseId, setSelectedCourseId] = useState('');

  const selectedCourseName = classCourses.find((c) => c._id === selectedCourseId)?.name ?? '';

  const skipGroups = !selectedCourseId;
  const { data: groups = [], isLoading, error } = useGetGroupsQuery(
    { classId, courseId: selectedCourseId },
    { skip: skipGroups },
  );
  const [generateGroups,   { isLoading: generating }]  = useGenerateGroupsMutation();
  const [regenerateGroups, { isLoading: regenerating }] = useRegenerateGroupsMutation();

  const [regenOpen,  setRegenOpen]  = useState(false);
  const [genWarning, setGenWarning] = useState(null);

  const hasGroups = groups.length > 0;
  const lastOpts  = groups[0]?.generationOptions;
  const className = cls?.name ?? '…';

  // Generate form (empty state)
  const {
    register: regGen,
    control:  ctrlGen,
    handleSubmit: submitGen,
  } = useForm({ defaultValues: { groupSize: 4, attendanceThreshold: 25 } });

  // Regenerate form (dialog) — pre-filled with last-used options
  const {
    register: regRegen,
    control:  ctrlRegen,
    handleSubmit: submitRegen,
  } = useForm({
    values: {
      groupSize:            lastOpts?.groupSize            ?? 4,
      attendanceThreshold:  lastOpts?.attendanceThreshold  ?? 25,
    },
  });

  async function handleGenerate(data) {
    try {
      const result = await generateGroups({
        classId,
        courseId:  selectedCourseId,
        groupSize: Number(data.groupSize),
        options:   { attendanceThreshold: Number(data.attendanceThreshold) },
      }).unwrap();
      setGenWarning(result.warning ?? null);
      toast.success(`${result.groups.length} groups generated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Generation failed');
    }
  }

  async function handleRegenerate(data) {
    try {
      const result = await regenerateGroups({
        classId,
        courseId:  selectedCourseId,
        groupSize: Number(data.groupSize),
        options:   { attendanceThreshold: Number(data.attendanceThreshold) },
      }).unwrap();
      setRegenOpen(false);
      setGenWarning(result.warning ?? null);
      toast.success(`${result.groups.length} groups regenerated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Regeneration failed');
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">
            <Link to="/classes" className="hover:underline">Classes</Link>
            {' / '}
            <Link to={`/classes/${classId}/students`} className="hover:underline">{className}</Link>
            {' / '}
            Groups
          </p>
          <h2 className="text-ink-900 mb-1">Groups</h2>
          {hasGroups && (
            <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
              {groups.length} group{groups.length !== 1 ? 's' : ''}
              {lastOpts && ` · size ${lastOpts.groupSize} · attendance threshold ${lastOpts.attendanceThreshold}%`}
            </p>
          )}
        </div>
        {hasGroups && (
          <Button variant="outline" className="ml-4 shrink-0" onClick={() => setRegenOpen(true)}>
            <RefreshCw size={15} />
            Regenerate
          </Button>
        )}
      </div>

      {/* Course selector */}
      <div className="mb-6 max-w-sm">
        <Label className="mb-1.5 block">Course</Label>
        {(isAdmin ? loadingClass : loadingAssignments) ? (
          <div className="flex items-center gap-2 text-sm text-ink-400">
            <Loader2 size={14} className="animate-spin" /> Loading courses…
          </div>
        ) : classCourses.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-ink-50 px-3 py-2 text-sm text-ink-400">
            <BookOpen size={14} />
            No courses assigned to this class yet.
          </div>
        ) : (
          <Select value={selectedCourseId} onValueChange={(v) => { setSelectedCourseId(v); setGenWarning(null); }}>
            <SelectTrigger>
              <SelectValue placeholder="Select a course to manage groups…" />
            </SelectTrigger>
            <SelectContent>
              {classCourses.map((course) => (
                <SelectItem key={course._id} value={course._id}>
                  {course.name}
                  {course.code && (
                    <span className="ml-1.5 font-mono text-xs text-ink-400">{course.code}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Generation warning */}
      {genWarning && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700 dark:text-amber-300">{genWarning}</p>
        </div>
      )}

      {/* Main content — only shown once a course is selected */}
      {!selectedCourseId ? null : isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-ink-300" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">
          {error?.data?.error?.message ?? 'Failed to load groups.'}
        </p>
      ) : !hasGroups ? (

        /* ── Generate form (empty state) ──────────────────────────────────── */
        <div className="max-w-md rounded-lg border border-border bg-white shadow-xs p-6">
          <h3 className="text-ink-800 mb-1" style={{ fontFamily: 'var(--font-sans)' }}>
            Generate Groups
          </h3>
          <p className="text-sm text-ink-500 mb-5">
            No groups yet for <strong>{selectedCourseName}</strong>. Configure the parameters and generate balanced groups.
          </p>
          <form onSubmit={submitGen(handleGenerate)} className="space-y-5" noValidate>
            <GenerateFields control={ctrlGen} register={regGen} />
            <Button type="submit" disabled={generating}>
              {generating && <Loader2 size={14} className="animate-spin" />}
              Generate Groups
            </Button>
          </form>
        </div>

      ) : (

        /* ── Groups view ──────────────────────────────────────────────────── */
        <>
          <BalanceSummary groups={groups} />
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group) => (
              <GroupCard
                key={group._id}
                group={group}
                onAdjust={() => navigate(`/groups/${group._id}`, { state: { classId, courseId: selectedCourseId } })}
              />
            ))}
          </div>
        </>

      )}

      {/* Regenerate dialog */}
      <Dialog open={regenOpen} onOpenChange={(v) => !v && setRegenOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Groups</DialogTitle>
            <DialogDescription>
              Archive the current groups for <strong>{selectedCourseName}</strong> and generate new ones.
              All manual adjustments will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <GenerateFields control={ctrlRegen} register={regRegen} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenOpen(false)}>Cancel</Button>
            <Button
              onClick={submitRegen(handleRegenerate)}
              disabled={regenerating}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {regenerating && <Loader2 size={14} className="animate-spin" />}
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
