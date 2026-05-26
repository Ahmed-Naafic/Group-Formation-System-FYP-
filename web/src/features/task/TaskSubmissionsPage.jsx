import { useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Loader2, ArrowLeft, Calendar, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetTaskByIdQuery,
  useGetTaskSubmissionsQuery,
  useUpdateTaskMutation,
  useGradeSubmissionMutation,
} from './taskApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// ── Status config ──────────────────────────────────────────────────────────────

const SUBMISSION_STATUS = {
  draft:     { label: 'Draft',     variant: 'secondary',    icon: Clock },
  submitted: { label: 'Submitted', variant: 'default',      icon: CheckCircle2 },
  late:      { label: 'Late',      variant: 'warning',      icon: AlertTriangle },
  reviewed:  { label: 'Reviewed',  variant: 'success',      icon: CheckCircle2 },
};

function SubmissionBadge({ status }) {
  const cfg = SUBMISSION_STATUS[status] ?? SUBMISSION_STATUS.draft;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Grade dialog ───────────────────────────────────────────────────────────────

function GradeDialog({ submission, onClose }) {
  const [gradeSubmission, { isLoading }] = useGradeSubmissionMutation();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { grade: submission?.grade ?? '' },
  });

  async function onSubmit(data) {
    try {
      await gradeSubmission({ id: submission._id, grade: Number(data.grade) }).unwrap();
      toast.success('Grade saved');
      onClose();
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to save grade');
    }
  }

  return (
    <Dialog open={!!submission} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Grade Submission</DialogTitle>
          <DialogDescription>
            {submission?.groupId?.name} — enter a score from 0 to 100.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-1" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="grade-input">Score (0–100) <span className="text-danger">*</span></Label>
            <Input
              id="grade-input"
              type="number"
              min={0}
              max={100}
              step="1"
              autoFocus
              {...register('grade', {
                required: 'Score is required',
                min: { value: 0, message: 'Min 0' },
                max: { value: 100, message: 'Max 100' },
              })}
              aria-invalid={!!errors.grade}
            />
            {errors.grade && <p className="text-xs text-danger">{errors.grade.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 size={14} className="animate-spin" />}
              Save Grade
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TaskSubmissionsPage() {
  const { taskId }  = useParams();
  const location    = useLocation();
  const classId     = location.state?.classId;

  const { data: task,        isLoading: loadingTask,  error: taskError }  = useGetTaskByIdQuery(taskId);
  const { data: submissions = [], isLoading: loadingSubs } = useGetTaskSubmissionsQuery(taskId);
  const [updateTask, { isLoading: toggling }] = useUpdateTaskMutation();

  const [gradeTarget, setGradeTarget] = useState(null);

  async function toggleStatus() {
    const next = task.status === 'open' ? 'closed' : 'open';
    try {
      await updateTask({ id: taskId, status: next }).unwrap();
      toast.success(`Task ${next === 'open' ? 'reopened' : 'closed'}`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to update task');
    }
  }

  const backTo = classId ? `/classes/${classId}/tasks` : '/classes';

  if (loadingTask) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={22} className="animate-spin text-ink-300" />
      </div>
    );
  }

  if (taskError || !task) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-danger mb-4">Task not found or access denied.</p>
        <Button variant="outline" asChild><Link to={backTo}>Go back</Link></Button>
      </div>
    );
  }

  // Build a complete row per assigned group — merge with existing submissions
  const submissionByGroup = {};
  for (const s of submissions) {
    const gid = String(s.groupId?._id ?? s.groupId);
    submissionByGroup[gid] = s;
  }

  const rows = (task.assignedGroups ?? []).map((g) => ({
    group:      g,
    submission: submissionByGroup[String(g._id)] ?? null,
  }));

  // Groups that submitted but aren't in assignedGroups (if task was open to all)
  const assignedIds = new Set((task.assignedGroups ?? []).map((g) => String(g._id)));
  for (const s of submissions) {
    const gid = String(s.groupId?._id ?? s.groupId);
    if (!assignedIds.has(gid)) {
      rows.push({ group: s.groupId, submission: s });
    }
  }

  const submitted   = submissions.filter((s) => ['submitted', 'late', 'reviewed'].includes(s.status)).length;
  const graded      = submissions.filter((s) => s.status === 'reviewed').length;
  const totalGroups = rows.length;

  return (
    <div>
      {/* Back */}
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to tasks
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-ink-900 leading-none">{task.title}</h2>
            <Badge variant={task.status === 'open' ? 'success' : 'secondary'}>
              {task.status === 'open' ? 'Open' : 'Closed'}
            </Badge>
          </div>
          {task.description && (
            <p className="text-sm text-ink-500 mt-1 max-w-xl">{task.description}</p>
          )}
          {task.deadline && (
            <p className="inline-flex items-center gap-1 text-xs text-ink-400 mt-1.5">
              <Calendar size={11} />
              Due {formatDate(task.deadline)}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleStatus}
          disabled={toggling}
          className={cn(
            task.status === 'open'
              ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
              : 'border-just-blue-200 text-just-blue-700 hover:bg-just-blue-50',
          )}
        >
          {toggling && <Loader2 size={13} className="animate-spin" />}
          {task.status === 'open' ? 'Close task' : 'Reopen task'}
        </Button>
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3 mb-5 text-sm">
        <span className="text-ink-500">{totalGroups} group{totalGroups !== 1 ? 's' : ''}</span>
        <span className="text-ink-300">·</span>
        <span className="text-ink-500">{submitted} submitted</span>
        <span className="text-ink-300">·</span>
        <span className={cn('font-medium', graded === totalGroups && totalGroups > 0 ? 'text-success' : 'text-ink-500')}>
          {graded} graded
        </span>
      </div>

      {/* Submissions table */}
      {loadingSubs ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-ink-300" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white py-12 text-center">
          <p className="text-sm text-ink-400">No groups assigned to this task yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Submitted by</TableHead>
                <TableHead className="text-right">Grade</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ group, submission }) => (
                <TableRow key={String(group?._id ?? group)}>
                  <TableCell className="font-medium text-ink-800">
                    {group?.name ?? '—'}
                  </TableCell>
                  <TableCell>
                    {submission
                      ? <SubmissionBadge status={submission.status} />
                      : <Badge variant="secondary">Not submitted</Badge>}
                  </TableCell>
                  <TableCell className="text-xs text-ink-500">
                    {formatDate(submission?.submittedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-ink-600">
                    {submission?.submittedBy?.fullName ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-ink-700">
                    {submission?.grade != null ? `${submission.grade}/100` : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {submission && ['submitted', 'late', 'reviewed'].includes(submission.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-just-blue-600 hover:text-just-blue-700"
                        onClick={() => setGradeTarget(submission)}
                      >
                        {submission.status === 'reviewed' ? 'Re-grade' : 'Grade'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {gradeTarget && (
        <GradeDialog submission={gradeTarget} onClose={() => setGradeTarget(null)} />
      )}
    </div>
  );
}
