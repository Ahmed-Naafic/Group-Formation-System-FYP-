import { useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2, Crown, Trash2, ArrowLeft, UserPlus, ExternalLink, Eye, EyeOff, Search } from 'lucide-react';
import { useCategoryVisibility } from '@/context/CategoryVisibilityContext';
import { toast } from 'sonner';
import { useGetGroupByIdQuery, useGetGroupsQuery, useUpdateGroupMutation } from './groupApi';
import { useGetWorkspaceByGroupIdQuery } from '@/features/workspace/workspaceApi';
import { useGetStudentsQuery } from '@/features/student/studentApi';
import { useGetCourseOfferingByIdQuery } from '@/features/courseOffering/courseOfferingApi';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

export default function GroupDetailPage() {
  const { id }   = useParams();
  const location = useLocation();
  const { showCategory, toggleCategory } = useCategoryVisibility();

  const { data: group, isLoading, error } = useGetGroupByIdQuery(id);
  const [updateGroup, { isLoading: updating }] = useUpdateGroupMutation();
  const { data: workspace } = useGetWorkspaceByGroupIdQuery(id);

  const courseOfferingId = group?.courseOfferingId
    ? String(group.courseOfferingId?._id ?? group.courseOfferingId)
    : undefined;

  const { data: offering } = useGetCourseOfferingByIdQuery(courseOfferingId, { skip: !courseOfferingId });
  const cohortId = offering ? String(offering.cohortId?._id ?? offering.cohortId) : undefined;

  const { data: allStudents = [] } = useGetStudentsQuery(cohortId, { skip: !cohortId });
  const { data: allGroups   = [] } = useGetGroupsQuery(
    { courseOfferingId },
    { skip: !courseOfferingId },
  );

  const [removeTarget,  setRemoveTarget]  = useState(null);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [availableQuery, setAvailableQuery] = useState('');

  // ── Derived data ────────────────────────────────────────────────────────────
  // `available` must be declared before `filteredAvailable` — the IIFE
  // references it directly, and accessing a `const` before its declaration
  // throws a TDZ ReferenceError in production bundles.

  const leaderId = group ? String(group.leaderId?._id ?? group.leaderId) : null;

  const takenIds = new Set();
  // A removed member populates as null (soft-deleted students are excluded
  // from the lookup) — skip those slots rather than crash on `m._id`.
  allGroups.forEach((g) => g.memberIds?.forEach((m) => m && takenIds.add(String(m._id))));
  const available = allStudents.filter((s) => !takenIds.has(String(s._id)));

  const filteredAvailable = (() => {
    const q = availableQuery.trim().toLowerCase();
    if (!q) return available;
    return available.filter((s) =>
      s.fullName.toLowerCase().includes(q) ||
      (s.userId?.studentId ?? '').toLowerCase().includes(q),
    );
  })();

  const backOfferingId = location.state?.courseOfferingId ?? courseOfferingId;
  const backTo = backOfferingId
    ? `/course-offerings/${backOfferingId}/groups`
    : '/course-offerings';

  const offeringLabel = offering
    ? [offering.courseId?.name, offering.cohortId?.name].filter(Boolean).join(' — ')
    : '…';

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function setLeader(studentId) {
    try {
      await updateGroup({ id, leaderId: studentId }).unwrap();
      toast.success('Leader updated');
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to update leader');
    }
  }

  async function confirmRemove() {
    try {
      await updateGroup({ id, removeMemberIds: [removeTarget._id] }).unwrap();
      toast.success(`${removeTarget.fullName} removed from group`);
      setRemoveTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to remove member');
    }
  }

  async function addMembers() {
    if (!selectedToAdd.length) return;
    try {
      await updateGroup({ id, addMemberIds: selectedToAdd }).unwrap();
      toast.success(`${selectedToAdd.length} student${selectedToAdd.length !== 1 ? 's' : ''} added`);
      setSelectedToAdd([]);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to add members');
    }
  }

  function toggleSelect(studentId) {
    setSelectedToAdd((prev) =>
      prev.includes(studentId)
        ? prev.filter((x) => x !== studentId)
        : [...prev, studentId],
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={22} className="animate-spin text-ink-300" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-danger mb-4">Group not found or you don't have access.</p>
        <Button variant="outline" asChild>
          <Link to="/course-offerings">Go to offerings</Link>
        </Button>
      </div>
    );
  }

  // Removed members populate as null — don't count them as active.
  const activeMembers = group.memberIds?.filter(Boolean) ?? [];
  const memberCount = activeMembers.length;

  return (
    <div className="max-w-2xl">
      {/* Back link */}
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back to groups
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1">{offeringLabel}</p>
          <h2 className="text-ink-900 mb-0.5">{group.name}</h2>
          <p className="text-sm text-ink-400">
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={toggleCategory}>
            {showCategory ? <EyeOff size={13} /> : <Eye size={13} />}
            {showCategory ? 'Hide Category' : 'Show Category'}
          </Button>
          {workspace && (
            <Button variant="outline" size="sm" className="gap-1.5" asChild>
              <Link to={`/workspaces/${workspace._id}`}>
                <ExternalLink size={13} /> Open Workspace
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* Members */}
        <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-ink-50/50">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Members</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Name</TableHead>
                <TableHead>Student ID</TableHead>
                {showCategory && <TableHead>Category</TableHead>}
                <TableHead className="w-36 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeMembers.map((m) => {
                const isLeader = String(m._id) === leaderId;
                return (
                  <TableRow key={m._id}>
                    <TableCell className="pr-0">
                      {isLeader && (
                        <Crown
                          size={13}
                          style={{ color: 'var(--just-gold-400)' }}
                          aria-label="Leader"
                        />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-ink-800">{m.fullName}</TableCell>
                    <TableCell className="font-mono text-xs text-ink-500">
                      {m.userId?.studentId ?? '—'}
                    </TableCell>
                    {showCategory && (
                      <TableCell>
                        <Badge variant={CATEGORY_VARIANT[m.performanceCategory] ?? 'secondary'}>
                          {m.performanceCategory ?? 'UNGRADED'}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {!isLeader && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                              onClick={() => setLeader(m._id)}
                              disabled={updating}
                            >
                              <Crown size={11} />
                              Set leader
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 hover:text-danger"
                              onClick={() => setRemoveTarget(m)}
                              disabled={updating || memberCount <= 1}
                              aria-label="Remove member"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Add members */}
        <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-ink-50/50 flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
              Add Members
            </p>
            {selectedToAdd.length > 0 && (
              <Button size="sm" className="h-7 text-xs gap-1" onClick={addMembers} disabled={updating}>
                {updating
                  ? <Loader2 size={11} className="animate-spin" />
                  : <UserPlus size={11} />}
                Add {selectedToAdd.length} student{selectedToAdd.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>

          {available.length === 0 ? (
            <p className="p-5 text-sm text-ink-400 text-center">
              All students in this cohort are already assigned to a group.
            </p>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-border relative">
                <Search size={13} className="absolute left-7 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
                <Input
                  placeholder="Search by name or student ID…"
                  value={availableQuery}
                  onChange={(e) => setAvailableQuery(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Name</TableHead>
                  <TableHead>Student ID</TableHead>
                  {showCategory && <TableHead>Category</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAvailable.length === 0 ? (
                  <TableRow><TableCell colSpan={showCategory ? 4 : 3} className="text-center py-6 text-sm text-ink-400">No students match "{availableQuery}"</TableCell></TableRow>
                ) : filteredAvailable.map((s) => {
                  const checked = selectedToAdd.includes(s._id);
                  return (
                    <TableRow
                      key={s._id}
                      className={cn('cursor-pointer select-none', checked && 'bg-just-blue-50/60')}
                      onClick={() => toggleSelect(s._id)}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          readOnly
                          checked={checked}
                          className="h-4 w-4 accent-just-blue-600 pointer-events-none"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-ink-800">{s.fullName}</TableCell>
                      <TableCell className="font-mono text-xs text-ink-500">
                        {s.userId?.studentId ?? '—'}
                      </TableCell>
                      {showCategory && (
                        <TableCell>
                          <Badge variant={CATEGORY_VARIANT[s.performanceCategory] ?? 'secondary'}>
                            {s.performanceCategory ?? 'UNGRADED'}
                          </Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </>
          )}
        </div>
      </div>

      {/* Remove confirm */}
      <AlertDialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove{' '}
              <span className="font-semibold text-ink-800">{removeTarget?.fullName}</span>{' '}
              from {group.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={updating}>
              {updating && <Loader2 size={14} className="animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
