import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, Crown, ChevronRight, ChevronDown, History } from 'lucide-react';
import { useGetGroupHistoryQuery } from './groupHistoryApi';
import { useGetCourseOfferingByIdQuery } from '@/features/courseOffering/courseOfferingApi';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCategoryVisibility } from '@/context/CategoryVisibilityContext';

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function MemberList({ members, leaderId }) {
  const leaderStr = String(leaderId?._id ?? leaderId ?? '');
  const { showCategory } = useCategoryVisibility();
  return (
    <div className="divide-y divide-border">
      {members.map((m) => {
        const isLeader = String(m._id) === leaderStr;
        return (
          <div key={m._id} className="flex items-center gap-2 px-4 py-2 text-sm">
            <span className="w-4 shrink-0">
              {isLeader && <Crown size={11} style={{ color: 'var(--just-gold-400)' }} />}
            </span>
            <span className="flex-1 font-medium text-ink-800">{m.fullName}</span>
            <span className="font-mono text-xs text-ink-400 shrink-0">
              {m.userId?.studentId ?? '—'}
            </span>
            {showCategory && (
              <Badge
                variant={CATEGORY_VARIANT[m.performanceCategory] ?? 'secondary'}
                className="text-[10px] px-1.5 py-0 h-4 shrink-0"
              >
                {m.performanceCategory ?? 'UNG'}
              </Badge>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GenerationCard({ generation, isOpen, onToggle }) {
  return (
    <div className={cn(
      'rounded-lg border bg-white shadow-xs overflow-hidden',
      generation.isActive ? 'border-just-blue-300' : 'border-border',
    )}>
      {/* Header row — always visible, click to expand */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-ink-50/50 transition-colors text-left"
      >
        <span className="shrink-0 text-ink-400">
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="font-semibold text-ink-800 text-sm">
            {formatDate(generation.generatedAt)}
          </span>
          <span className="ml-3 text-xs text-ink-400">
            {generation.groups.length} groups of {generation.groupSize}
          </span>
        </span>
        {generation.isActive && (
          <span className="shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-just-blue-100 text-just-blue-700">
            Current
          </span>
        )}
      </button>

      {/* Expanded: grid of groups */}
      {isOpen && (
        <div className="border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-border">
            {generation.groups.map((group, gi) => (
              <div key={gi} className="bg-white">
                <div className="px-4 py-2 bg-ink-50/60 border-b border-border">
                  <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
                    Group {gi + 1}
                  </p>
                </div>
                <MemberList members={group.memberIds} leaderId={group.leaderId} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GroupHistoryPage() {
  const { offeringId } = useParams();
  const { data: offering, isLoading: loadingOffering } = useGetCourseOfferingByIdQuery(offeringId);
  const { data: generations = [], isLoading, error }   = useGetGroupHistoryQuery(offeringId);

  const [openIds, setOpenIds] = useState(new Set());

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const courseName    = offering?.courseId?.name ?? (loadingOffering ? '…' : 'Offering');
  const cohortName    = offering?.cohortId?.name ?? '';
  const semesterName  = offering?.semesterId?.name ?? '';
  const offeringLabel = [courseName, cohortName, semesterName].filter(Boolean).join(' — ');

  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow mb-1">
          <Link to="/course-offerings" className="hover:underline">Course Offerings</Link>
          {' / '}
          {offeringLabel}
          {' / '}
          History
        </p>
        <h2 className="text-ink-900 mb-1">Group History</h2>
        <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
          Past group generations for {courseName}, newest first. Used by the engine to avoid
          repeating prior pairs across semesters within this cohort.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-ink-300" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger p-4">{error?.data?.error?.message ?? 'Failed to load history.'}</p>
      ) : generations.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-12 flex flex-col items-center gap-3 text-center">
          <History size={32} className="text-ink-200" />
          <p className="text-sm text-ink-500 font-medium">No generation history yet</p>
          <p className="text-xs text-ink-300">
            History is written when groups are regenerated. Generate and regenerate groups for an
            offering to populate this view.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {generations.map((gen) => {
            const id = String(gen.generationId);
            return (
              <GenerationCard
                key={id}
                generation={gen}
                isOpen={openIds.has(id)}
                onToggle={() => toggle(id)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
