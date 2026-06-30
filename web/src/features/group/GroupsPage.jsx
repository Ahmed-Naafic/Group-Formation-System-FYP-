import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import {
  Loader2, RefreshCw, Crown, AlertTriangle, ArrowRight, Trash2, ExternalLink, FileDown, Eye, EyeOff,
} from 'lucide-react';
import { useCategoryVisibility } from '@/context/CategoryVisibilityContext';
import { toast } from 'sonner';
import { selectCurrentToken } from '@/features/auth/authSlice';
import {
  useGetGroupsQuery,
  useGenerateGroupsMutation,
  useRegenerateGroupsMutation,
  useDeleteGroupsMutation,
} from './groupApi';
import { useGetCourseOfferingByIdQuery } from '@/features/courseOffering/courseOfferingApi';
import { useLazyGetWorkspaceByGroupIdQuery } from '@/features/workspace/workspaceApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

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
      {[3, 4, 5, 6, 8, 10, 12].map((n) => (
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

function GroupCard({ group, onAdjust, onOpenWorkspace, workspaceLoading, showCategory }) {
  const leaderId = String(group.leaderId?._id ?? group.leaderId);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-1">
          <CardTitle className="text-base font-semibold text-ink-800 truncate min-w-0">
            {group.name}
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-ink-500 hover:text-ink-800"
              onClick={() => onOpenWorkspace(group._id)}
              disabled={workspaceLoading === group._id}
              title="Open workspace"
            >
              {workspaceLoading === group._id
                ? <Loader2 size={11} className="animate-spin" />
                : <ExternalLink size={11} />}
              Workspace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-just-blue-600 hover:text-just-blue-700"
              onClick={onAdjust}
            >
              Adjust <ArrowRight size={11} />
            </Button>
          </div>
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
                {showCategory && (
                  <Badge
                    variant={CATEGORY_VARIANT[m.performanceCategory] ?? 'secondary'}
                    className="shrink-0 text-[10px] px-1.5 py-0 h-4"
                  >
                    {m.performanceCategory ?? 'UNG'}
                  </Badge>
                )}
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
  const { offeringId } = useParams();
  const navigate       = useNavigate();
  const { showCategory, toggleCategory } = useCategoryVisibility();

  const { data: offering, isLoading: loadingOffering } = useGetCourseOfferingByIdQuery(offeringId);

  const { data: groups = [], isLoading, error } = useGetGroupsQuery({ courseOfferingId: offeringId });
  const [generateGroups,   { isLoading: generating }]  = useGenerateGroupsMutation();
  const [regenerateGroups, { isLoading: regenerating }] = useRegenerateGroupsMutation();
  const [deleteGroups,     { isLoading: deleting }]     = useDeleteGroupsMutation();

  const token = useSelector(selectCurrentToken);

  const [fetchWorkspace]          = useLazyGetWorkspaceByGroupIdQuery();
  const [workspaceLoading, setWorkspaceLoading] = useState(null); // group._id being opened

  const [regenOpen,  setRegenOpen]  = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [genWarning, setGenWarning] = useState(null);

  const hasGroups  = groups.length > 0;
  const lastOpts   = groups[0]?.generationOptions;

  const courseName   = offering?.courseId?.name ?? (loadingOffering ? '…' : 'Offering');
  const cohortName   = offering?.cohortId?.name ?? '';
  const semesterName = offering?.semesterId?.name ?? '';
  const offeringLabel = [courseName, cohortName, semesterName].filter(Boolean).join(' — ');

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

  async function downloadExcel(path, filename, label) {
    toast.info(`Downloading ${label}…`);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download Excel file');
    }
  }

  async function handleOpenWorkspace(groupId) {
    setWorkspaceLoading(groupId);
    try {
      const ws = await fetchWorkspace(groupId).unwrap();
      navigate(`/workspaces/${ws._id}`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Could not open workspace');
    } finally {
      setWorkspaceLoading(null);
    }
  }

  async function handleGenerate(data) {
    try {
      const result = await generateGroups({
        courseOfferingId: offeringId,
        groupSize: Number(data.groupSize),
        options:   { attendanceThreshold: Number(data.attendanceThreshold) },
      }).unwrap();
      setGenWarning(result.warning ?? null);
      toast.success(`${result.groups.length} groups generated`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Generation failed');
    }
  }

  async function handleDeleteAll() {
    try {
      const result = await deleteGroups({ courseOfferingId: offeringId }).unwrap();
      setDeleteOpen(false);
      setGenWarning(null);
      toast.success(`${result.archived} group${result.archived !== 1 ? 's' : ''} deleted`);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete groups');
    }
  }

  async function handleRegenerate(data) {
    try {
      const result = await regenerateGroups({
        courseOfferingId: offeringId,
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
            <Link to="/course-offerings" className="hover:underline">Course Offerings</Link>
            {' / '}
            {offeringLabel}
          </p>
          <h2 className="text-ink-900 mb-1">Groups</h2>
          {hasGroups && (
            <p className="text-ink-500" style={{ fontSize: 'var(--fs-small)' }}>
              {groups.length} group{groups.length !== 1 ? 's' : ''}
              {lastOpts && ` · size ${lastOpts.groupSize} · attendance threshold ${lastOpts.attendanceThreshold}%`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          {hasGroups && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleCategory}
                title={showCategory ? 'Hide performance category' : 'Show performance category'}
              >
                {showCategory ? <EyeOff size={14} /> : <Eye size={14} />}
                {showCategory ? 'Hide Category' : 'Show Category'}
              </Button>
              <Button
                size="sm"
                className="bg-just-blue-600 hover:bg-just-blue-700 text-white"
                onClick={() => downloadExcel(
                  `/api/reports/groups/formatted?courseOfferingId=${offeringId}`,
                  `group_list_${courseName.replace(/\s+/g, '_')}.xlsx`,
                  'group list',
                )}
              >
                <FileDown size={15} />
                Group list (Excel)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-danger hover:text-danger hover:bg-danger/10 border-danger/30"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 size={15} />
                Delete All
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRegenOpen(true)}>
                <RefreshCw size={15} />
                Regenerate
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Generation warning */}
      {genWarning && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 bg-[var(--surface-warning)] border-[var(--surface-warning-border)]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--fg-warning)]" />
          <p className="text-sm text-[var(--fg-warning)]">{genWarning}</p>
        </div>
      )}

      {/* Main content */}
      {isLoading ? (
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
            No groups yet for <strong>{courseName}</strong>. Configure the parameters and generate balanced groups.
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
          {showCategory && <BalanceSummary groups={groups} />}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map((group) => (
              <GroupCard
                key={group._id}
                group={group}
                showCategory={showCategory}
                onAdjust={() => navigate(`/groups/${group._id}`, { state: { courseOfferingId: offeringId } })}
                onOpenWorkspace={handleOpenWorkspace}
                workspaceLoading={workspaceLoading}
              />
            ))}
          </div>
        </>

      )}

      {/* Delete all groups confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={(v) => !v && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Groups</AlertDialogTitle>
            <AlertDialogDescription>
              Archive all{' '}
              <span className="font-semibold text-ink-800">{groups.length} group{groups.length !== 1 ? 's' : ''}</span>{' '}
              for <span className="font-semibold text-ink-800">{courseName}</span>?
              Group history and workspaces are preserved. You can generate fresh groups afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger hover:bg-danger/90 text-white"
              onClick={handleDeleteAll}
              disabled={deleting}
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Delete All Groups
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate dialog */}
      <Dialog open={regenOpen} onOpenChange={(v) => !v && setRegenOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate Groups</DialogTitle>
            <DialogDescription>
              Archive the current groups for <strong>{courseName}</strong> and generate new ones.
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
