import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Loader2, Plus, Trash2, ClipboardList, ArrowRight, Calendar, Paperclip, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
} from './taskApi';
import { useGetGroupsQuery } from '@/features/group/groupApi';
import { useGetCourseOfferingByIdQuery } from '@/features/courseOffering/courseOfferingApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusBadge(status) {
  return status === 'open'
    ? <Badge variant="success">Open</Badge>
    : <Badge variant="secondary">Closed</Badge>;
}

function deadlineLabel(deadline) {
  if (!deadline) return null;
  const d    = new Date(deadline);
  const now  = new Date();
  const diff = Math.round((d - now) / 86400000);
  const fmt  = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const color = diff < 0
    ? 'text-danger'
    : diff <= 3
      ? 'text-[var(--fg-warning)]'
      : 'text-ink-500';
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', color)}>
      <Calendar size={11} />
      {fmt}{diff < 0 ? ' — overdue' : diff === 0 ? ' — due today' : ''}
    </span>
  );
}

// ── Group picker ───────────────────────────────────────────────────────────────

function GroupPicker({ groups, selected, onChange }) {
  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  if (!groups.length) {
    return <p className="text-sm text-ink-400">No active groups in this offering yet.</p>;
  }
  return (
    <div className="max-h-44 overflow-y-auto rounded-md border border-border divide-y divide-border">
      {groups.map((g) => (
        <label
          key={g._id}
          className={cn(
            'flex items-center gap-3 px-3 py-2 cursor-pointer text-sm hover:bg-ink-50 transition-colors',
            selected.includes(g._id) && 'bg-just-blue-50/60',
          )}
        >
          <input
            type="checkbox"
            checked={selected.includes(g._id)}
            onChange={() => toggle(g._id)}
            className="h-4 w-4 accent-just-blue-600"
          />
          <span className="font-medium text-ink-800 flex-1">{g.name}</span>
          <span className="text-ink-400 text-xs">{g.memberIds?.length ?? 0} members</span>
        </label>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const { offeringId } = useParams();
  const navigate       = useNavigate();

  const { data: offering }                           = useGetCourseOfferingByIdQuery(offeringId);
  const { data: tasks = [], isLoading, error }       = useGetTasksQuery(offeringId);
  const { data: groups = [] }                        = useGetGroupsQuery({ courseOfferingId: offeringId });
  const [createTask, { isLoading: creating }]        = useCreateTaskMutation();
  const [updateTask, { isLoading: updating }]        = useUpdateTaskMutation();
  const [deleteTask, { isLoading: deleting }]        = useDeleteTaskMutation();

  const [newOpen,        setNewOpen]        = useState(false);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [editTarget,     setEditTarget]     = useState(null);
  const [editDeadline,   setEditDeadline]   = useState('');
  const [editStatus,     setEditStatus]     = useState('open');
  const [pickedGroups,   setPickedGroups]   = useState([]);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const fileInputRef = useRef(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: { title: '', description: '', deadline: '' },
  });

  const offeringLabel = offering
    ? [offering.courseId?.name, offering.cohortId?.name].filter(Boolean).join(' — ')
    : '…';

  function resetDialog() {
    setNewOpen(false);
    reset();
    setPickedGroups([]);
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openEdit(task) {
    setEditTarget(task);
    setEditDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : '');
    setEditStatus(task.status);
  }

  function closeEdit() {
    setEditTarget(null);
    setEditDeadline('');
    setEditStatus('open');
  }

  async function confirmEdit() {
    try {
      await updateTask({
        id:       editTarget._id,
        status:   editStatus,
        deadline: editDeadline ? `${editDeadline}T23:59` : undefined,
      }).unwrap();
      toast.success('Task updated');
      closeEdit();
    } catch (err) {
      const e = err?.data?.error;
      toast.error(e?.details?.length ? e.details.join(' · ') : (e?.message ?? 'Failed to update task'));
    }
  }

  async function onCreateTask(data) {
    try {
      let body;
      // Date-only input sends YYYY-MM-DD; append end-of-day time so the
      // deadline means "by end of that day" and passes the future check.
      const deadline = data.deadline ? `${data.deadline}T23:59` : undefined;
      if (attachmentFile) {
        // Multipart — matches the pattern used by student bulk-upload
        const form = new FormData();
        form.append('courseOfferingId', offeringId);
        form.append('title',            data.title.trim());
        if (data.description?.trim()) form.append('description', data.description.trim());
        if (deadline)                 form.append('deadline',    deadline);
        form.append('assignedGroupIds', JSON.stringify(pickedGroups));
        form.append('file', attachmentFile);
        body = form;
      } else {
        body = {
          courseOfferingId: offeringId,
          title:            data.title.trim(),
          description:      data.description?.trim() || undefined,
          deadline,
          assignedGroupIds: pickedGroups,
        };
      }
      await createTask(body).unwrap();
      toast.success('Task created');
      resetDialog();
    } catch (err) {
      const e = err?.data?.error;
      toast.error(e?.details?.length ? e.details.join(' · ') : (e?.message ?? 'Failed to create task'));
    }
  }

  async function confirmDelete() {
    try {
      await deleteTask(deleteTarget._id).unwrap();
      toast.success('Task deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to delete task');
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
          <h2 className="text-ink-900">Tasks</h2>
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus size={15} /> New Task
        </Button>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-ink-300" />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load tasks.'}</p>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white py-16 flex flex-col items-center gap-3">
          <ClipboardList size={32} className="text-ink-200" />
          <p className="text-sm text-ink-400">No tasks yet. Create the first one.</p>
          <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
            <Plus size={13} /> New Task
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task._id}
              className="rounded-lg border border-border bg-white shadow-xs px-5 py-4 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-ink-800 text-sm">{task.title}</span>
                  {statusBadge(task.status)}
                </div>
                {task.description && (
                  <p className="text-sm text-ink-500 line-clamp-1 mb-1">{task.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-ink-400">
                  {deadlineLabel(task.deadline)}
                  <span>
                    {!task.assignedGroups?.length
                      ? 'All groups'
                      : `${task.assignedGroups.length} group${task.assignedGroups.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost" size="sm"
                  className="h-7 text-xs gap-1 text-just-blue-600 hover:text-just-blue-700"
                  onClick={() => navigate(`/tasks/${task._id}/submissions`, { state: { offeringId } })}
                >
                  Submissions <ArrowRight size={11} />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 hover:text-just-blue-600"
                  onClick={() => openEdit(task)}
                  aria-label="Edit task"
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 hover:text-danger"
                  onClick={() => setDeleteTarget(task)}
                  disabled={deleting}
                  aria-label="Delete task"
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New task dialog */}
      <Dialog open={newOpen} onOpenChange={(v) => { if (!v) resetDialog(); }}>
        <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Assign a task to one or more groups in {offeringLabel}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onCreateTask)} className="space-y-4 py-1" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Title <span className="text-danger">*</span></Label>
              <Input
                id="t-title"
                placeholder="e.g. Final Project Submission"
                {...register('title', { required: 'Title is required' })}
                aria-invalid={!!errors.title}
              />
              {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-desc">Description</Label>
              <textarea
                id="t-desc"
                rows={3}
                placeholder="Instructions, requirements…"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                {...register('description')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-deadline">Deadline <span className="text-danger">*</span></Label>
              <div className="relative">
                <Input
                  id="t-deadline"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0"
                  {...register('deadline')}
                />
                <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign to groups</Label>
              <GroupPicker groups={groups} selected={pickedGroups} onChange={setPickedGroups} />
              <p className="text-xs text-ink-400">
                {pickedGroups.length === 0
                  ? 'No groups selected — task will be visible to all groups.'
                  : `${pickedGroups.length} group${pickedGroups.length !== 1 ? 's' : ''} selected.`}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Attachment <span className="text-ink-400 font-normal">(optional)</span></Label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
              />
              {attachmentFile ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-ink-50 px-3 py-2 text-sm">
                  <Paperclip size={13} className="shrink-0 text-ink-400" />
                  <span className="flex-1 truncate text-ink-700 min-w-0">{attachmentFile.name}</span>
                  <button
                    type="button"
                    onClick={() => { setAttachmentFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="shrink-0 text-ink-400 hover:text-danger transition-colors"
                    aria-label="Remove attachment"
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip size={13} /> Attach file
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 size={14} className="animate-spin" />}
                Create Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit task dialog */}
      <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) closeEdit(); }}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update the deadline or status of &ldquo;{editTarget?.title}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="e-deadline">Deadline</Label>
              <div className="relative">
                <Input
                  id="e-deadline"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0"
                />
                <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <div className="flex gap-2">
                {['open', 'closed'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditStatus(s)}
                    className={cn(
                      'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                      editStatus === s
                        ? 'border-just-blue-600 bg-just-blue-50 text-just-blue-700'
                        : 'border-border text-ink-500 hover:bg-ink-50',
                    )}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              {editStatus === 'open' && (
                <p className="text-xs text-ink-400">
                  Reopening requires a deadline in the future.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button onClick={confirmEdit} disabled={updating}>
              {updating && <Loader2 size={14} className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <span className="font-semibold text-ink-800">"{deleteTarget?.title}"</span>?
              All associated submissions will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-danger hover:bg-danger/90">
              {deleting && <Loader2 size={14} className="animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
