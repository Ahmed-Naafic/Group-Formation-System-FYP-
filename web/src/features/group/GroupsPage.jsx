import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import {
  Loader2, RefreshCw, Crown, AlertTriangle, ArrowRight, Trash2, ExternalLink, FileDown, Search, Megaphone, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { selectCurrentToken, selectRole } from '@/features/auth/authSlice';
import {
  useGetGroupsQuery,
  useGenerateGroupsMutation,
  useRegenerateGroupsMutation,
  useDeleteGroupsMutation,
} from './groupApi';
import { useGetCourseOfferingByIdQuery, useBroadcastMessageMutation } from '@/features/courseOffering/courseOfferingApi';
import { useLazyGetWorkspaceByGroupIdQuery } from '@/features/workspace/workspaceApi';
import { useCategoryVisibility } from '@/features/performance/useCategoryVisibility';
import CategoryBadge from '@/features/performance/CategoryBadge';
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
          {/* Removed members populate as null — don't render/count them as active. */}
          {group.memberIds?.filter(Boolean).map((m) => {
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
                {showCategory && (
                  <span className="shrink-0"><CategoryBadge category={m.performanceCategory} /></span>
                )}
                <span className="font-mono text-[11px] text-ink-400 shrink-0">
                  {m.userId?.studentId ?? '—'}
                </span>
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

  const { data: offering, isLoading: loadingOffering } = useGetCourseOfferingByIdQuery(offeringId);

  const { data: groups = [], isLoading, error } = useGetGroupsQuery({ courseOfferingId: offeringId });
  const [generateGroups,   { isLoading: generating }]  = useGenerateGroupsMutation();
  const [regenerateGroups, { isLoading: regenerating }] = useRegenerateGroupsMutation();
  const [deleteGroups,     { isLoading: deleting }]     = useDeleteGroupsMutation();
  const [broadcastMessage, { isLoading: broadcasting }] = useBroadcastMessageMutation();

  const token = useSelector(selectCurrentToken);
  const isInstructor = useSelector(selectRole) === 'instructor';
  const { canShow: canShowCategory, visible: showCategory, toggle: toggleCategory } = useCategoryVisibility();

  const [fetchWorkspace]          = useLazyGetWorkspaceByGroupIdQuery();
  const [workspaceLoading, setWorkspaceLoading] = useState(null); // group._id being opened

  const [regenOpen,  setRegenOpen]  = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [genWarning, setGenWarning] = useState(null);
  const [broadcastOpen,    setBroadcastOpen]    = useState(false);
  const [broadcastContent, setBroadcastContent] = useState('');

  const [query, setQuery] = useState('');

  const hasGroups  = groups.length > 0;
  const filteredGroups = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  })();
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

  async function handleBroadcast() {
    if (!broadcastContent.trim()) return;
    try {
      const result = await broadcastMessage({ id: offeringId, content: broadcastContent.trim() }).unwrap();
      toast.success(`Announcement sent to ${result.sentCount} group${result.sentCount !== 1 ? 's' : ''}`);
      setBroadcastOpen(false);
      setBroadcastContent('');
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to send announcement');
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
              {canShowCategory && (
                <Button variant="outline" size="sm" onClick={toggleCategory}>
                  {showCategory ? <EyeOff size={15} /> : <Eye size={15} />}
                  {showCategory ? 'Hide Category' : 'Show Category'}
                </Button>
              )}
              {isInstructor && (
                <Button variant="outline" size="sm" onClick={() => setBroadcastOpen(true)}>
                  <Megaphone size={15} />
                  Broadcast
                </Button>
              )}
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
          <div className="mt-5 mb-4 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <Input
              placeholder="Search groups…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredGroups.length === 0 ? (
              <p className="col-span-3 text-center py-8 text-sm text-ink-400">No groups match "{query}"</p>
            ) : filteredGroups.map((group) => (
              <GroupCard
                key={group._id}
                group={group}
                onAdjust={() => navigate(`/groups/${group._id}`, { state: { courseOfferingId: offeringId } })}
                onOpenWorkspace={handleOpenWorkspace}
                workspaceLoading={workspaceLoading}
                showCategory={showCategory}
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

      {/* Broadcast to all groups */}
      <Dialog open={broadcastOpen} onOpenChange={(v) => { if (!v) { setBroadcastOpen(false); setBroadcastContent(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast to All Groups</DialogTitle>
            <DialogDescription>
              Sends one announcement to every group's chat in <strong>{courseName}</strong> ({groups.length} group{groups.length !== 1 ? 's' : ''}) at once,
              instead of sending it to each group separately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="broadcast-content">Message</Label>
            <textarea
              id="broadcast-content"
              rows={4}
              maxLength={4000}
              placeholder="e.g. The deadline for Task 3 has been extended to Friday."
              value={broadcastContent}
              onChange={(e) => setBroadcastContent(e.target.value)}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            <Button onClick={handleBroadcast} disabled={!broadcastContent.trim() || broadcasting}>
              {broadcasting && <Loader2 size={14} className="animate-spin" />}
              Send to All Groups
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
