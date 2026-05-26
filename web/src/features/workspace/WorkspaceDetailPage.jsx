import { Link, useParams } from 'react-router-dom';
import { Loader2, Crown, ArrowLeft } from 'lucide-react';
import { useGetWorkspaceByIdQuery } from './workspaceApi';
import { Badge } from '@/components/ui/badge';

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

export default function WorkspaceDetailPage() {
  const { id } = useParams();
  const { data: workspace, isLoading, error } = useGetWorkspaceByIdQuery(id);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={22} className="animate-spin text-ink-300" />
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-danger mb-4">Workspace not found or access denied.</p>
        <Link to="/" className="text-sm text-just-blue-600 hover:underline">← Back to dashboard</Link>
      </div>
    );
  }

  const group    = workspace.groupId;
  const cls      = group?.classId;
  const course   = group?.courseId;
  const semester = cls?.semesterId;
  const leaderId = String(group?.leaderId?._id ?? group?.leaderId);

  return (
    <div className="max-w-2xl">
      {/* Back */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </Link>

      {/* Header */}
      <div className="mb-6">
        <p className="eyebrow mb-1">
          {cls?.name ?? '—'}
          {course && <> &middot; {course.name}{course.code && <span className="font-mono text-xs text-ink-400 ml-1">({course.code})</span>}</>}
        </p>
        <h2 className="text-ink-900 mb-0.5">{group?.name ?? '—'}</h2>
        {semester && (
          <p className="text-sm text-ink-400">{semester.name} · {semester.year}</p>
        )}
      </div>

      {/* Members */}
      <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-ink-50/50">
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
            Group Members — {group?.memberIds?.length ?? 0}
          </p>
        </div>
        <div className="divide-y divide-border">
          {group?.memberIds?.map((m) => {
            const isLeader = String(m._id) === leaderId;
            return (
              <div key={m._id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 shrink-0 flex items-center justify-center">
                  {isLeader && (
                    <Crown size={13} style={{ color: 'var(--just-gold-400)' }} />
                  )}
                </span>
                <span className="flex-1 font-medium text-ink-800 text-sm">{m.fullName}</span>
                <span className="font-mono text-xs text-ink-400">{m.userId?.studentId ?? '—'}</span>
                <Badge
                  variant={CATEGORY_VARIANT[m.performanceCategory] ?? 'secondary'}
                  className="text-[10px] px-1.5 py-0 h-4"
                >
                  {m.performanceCategory ?? 'UNGRADED'}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
