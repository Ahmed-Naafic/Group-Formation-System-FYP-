import { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Loader2, Plus, Trash2, ClipboardList, ArrowRight, Calendar, Paperclip, X, Pencil, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetTasksQuery,
  useCreateTaskMutation,
  useCreateBulkTasksMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
} from './taskApi';
import { useGenerateTaskMutation, useGenerateTaskVariationsMutation } from '@/features/ai/aiApi';
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
  const allSelected = selected.length === groups.length;
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <label className="flex items-center gap-3 px-3 py-2 cursor-pointer text-sm bg-ink-50 hover:bg-ink-100 transition-colors border-b border-border">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => onChange(allSelected ? [] : groups.map((g) => g._id))}
          className="h-4 w-4 accent-just-blue-600"
        />
        <span className="font-medium text-ink-800">Select all groups</span>
      </label>
      <div className="max-h-44 overflow-y-auto divide-y divide-border">
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
  const [createTask, { isLoading: creating }]              = useCreateTaskMutation();
  const [createBulkTasks, { isLoading: creatingBulk }]     = useCreateBulkTasksMutation();
  const [updateTask, { isLoading: updating }]              = useUpdateTaskMutation();
  const [deleteTask, { isLoading: deleting }]              = useDeleteTaskMutation();
  const [generateTask, { isLoading: generating }]          = useGenerateTaskMutation();
  const [generateTaskVariations, { isLoading: generatingVariations }] = useGenerateTaskVariationsMutation();
  const [regenerateOneVariation]                           = useGenerateTaskVariationsMutation();

  const [statusFilter,       setStatusFilter]       = useState('all');
  const [newOpen,            setNewOpen]            = useState(false);
  const [deleteTarget,       setDeleteTarget]       = useState(null);
  const [editTarget,         setEditTarget]         = useState(null);
  const [editDeadline,       setEditDeadline]       = useState('');
  const [editStatus,         setEditStatus]         = useState('open');
  const [editSubmissionType, setEditSubmissionType] = useState('group');
  const [pickedGroups,       setPickedGroups]       = useState([]);
  const [submissionType,     setSubmissionType]     = useState('group');
  const [attachmentFile,     setAttachmentFile]     = useState(null);
  const [aiPrompt,           setAiPrompt]           = useState('');
  const [aiError,            setAiError]            = useState(null);
  const [aiMode,             setAiMode]             = useState('single'); // 'single' | 'variations'
  const [variations,         setVariations]         = useState(null);
  const [regeneratingGroupId, setRegeneratingGroupId] = useState(null);
  const [backToSingleConfirmOpen, setBackToSingleConfirmOpen] = useState(false);
  const fileInputRef = useRef(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    defaultValues: { title: '', description: '', deadline: '' },
    shouldUnregister: true,
  });

  const isVariationsMode = pickedGroups.length >= 2 && aiMode === 'variations';

  function handleGroupsChange(next) {
    setPickedGroups(next);
    setVariations(null); // stale once the group selection changes
  }

  const offeringLabel = offering
    ? [offering.courseId?.name, offering.cohortId?.name].filter(Boolean).join(' — ')
    : '…';

  function resetDialog() {
    setNewOpen(false);
    reset();
    setPickedGroups([]);
    setSubmissionType('group');
    setAttachmentFile(null);
    setAiPrompt('');
    setAiError(null);
    setAiMode('single');
    setVariations(null);
    setRegeneratingGroupId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleGenerateWithAI() {
    setAiError(null);
    if (isVariationsMode) {
      try {
        const result = await generateTaskVariations({ prompt: aiPrompt.trim(), groupIds: pickedGroups }).unwrap();
        setVariations(result);
      } catch (err) {
        const e = err?.data?.error;
        setAiError(e?.details?.length ? e.details.join(' · ') : (e?.message ?? 'AI generation failed. Please try again.'));
      }
      return;
    }
    try {
      const { title, description } = await generateTask(aiPrompt.trim()).unwrap();
      setValue('title', title, { shouldValidate: true });
      setValue('description', description, { shouldValidate: true });
    } catch (err) {
      const e = err?.data?.error;
      setAiError(e?.details?.length ? e.details.join(' · ') : (e?.message ?? 'AI generation failed. Please try again.'));
    }
  }

  function updateVariationField(index, field, value) {
    setVariations((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  }

  async function handleRegenerateOne(index) {
    const target = variations[index];
    setAiError(null);
    setRegeneratingGroupId(target.groupId);
    try {
      const [result] = await regenerateOneVariation({ prompt: aiPrompt.trim(), groupIds: [target.groupId] }).unwrap();
      setVariations((prev) => prev.map((v, i) => (i === index ? { ...v, title: result.title, description: result.description } : v)));
    } catch (err) {
      const e = err?.data?.error;
      setAiError(e?.details?.length ? e.details.join(' · ') : (e?.message ?? 'AI generation failed. Please try again.'));
    } finally {
      setRegeneratingGroupId(null);
    }
  }

  function handleBackToSingle() {
    if (variations) {
      setBackToSingleConfirmOpen(true);
    } else {
      setAiMode('single');
    }
  }

  function confirmBackToSingle() {
    setAiMode('single');
    setVariations(null);
    setBackToSingleConfirmOpen(false);
  }

  function openEdit(task) {
    setEditTarget(task);
    setEditDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 10) : '');
    setEditStatus(task.status);
    setEditSubmissionType(task.submissionType ?? 'group');
  }

  function closeEdit() {
    setEditTarget(null);
    setEditDeadline('');
    setEditStatus('open');
    setEditSubmissionType('group');
  }

  async function confirmEdit() {
    try {
      await updateTask({
        id:             editTarget._id,
        status:         editStatus,
        deadline:       editDeadline ? `${editDeadline}T23:59` : undefined,
        submissionType: editSubmissionType,
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
        form.append('submissionType',   submissionType);
        form.append('file', attachmentFile);
        body = form;
      } else {
        body = {
          courseOfferingId: offeringId,
          title:            data.title.trim(),
          description:      data.description?.trim() || undefined,
          deadline,
          assignedGroupIds: pickedGroups,
          submissionType,
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

  async function onCreateBulkTasks(data) {
    if (variations.some((v) => !v.title.trim())) {
      toast.error('Every group needs a title before creating tasks');
      return;
    }
    try {
      const deadlineAt = data.deadline ? `${data.deadline}T23:59` : undefined;
      const tasks = variations.map((v) => ({
        groupId:     v.groupId,
        title:       v.title.trim(),
        description: v.description?.trim() || undefined,
      }));
      await createBulkTasks({ deadlineAt, tasks }).unwrap();
      toast.success(`${tasks.length} tasks created`);
      resetDialog();
    } catch (err) {
      const e = err?.data?.error;
      toast.error(e?.details?.length ? e.details.join(' · ') : (e?.message ?? 'Failed to create tasks'));
    }
  }

  function onSubmitNewTask(data) {
    return isVariationsMode ? onCreateBulkTasks(data) : onCreateTask(data);
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

      {/* Status filter */}
      {!isLoading && !error && tasks.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          {['all', 'open', 'closed'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-just-blue-600 text-white'
                  : 'bg-white border border-border text-ink-500 hover:border-just-blue-300 hover:text-just-blue-600'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}

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
          {(() => {
            const filteredTasks = statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter);
            return filteredTasks.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-8">No {statusFilter} tasks.</p>
            ) : filteredTasks.map((task) => (
            <div
              key={task._id}
              className="rounded-lg border border-border bg-white shadow-xs px-5 py-4 flex items-start gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-semibold text-ink-800 text-sm">{task.title}</span>
                  {statusBadge(task.status)}
                  <Badge variant={task.submissionType === 'individual' ? 'outline' : 'secondary'} className="text-[10px]">
                    {task.submissionType === 'individual' ? 'Individual' : 'Group'}
                  </Badge>
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
          ));
          })()}
        </div>
      )}

      {/* New task dialog */}
      <Dialog open={newOpen} onOpenChange={(v) => { if (!v) resetDialog(); }}>
        <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
            <DialogDescription>Assign a task to one or more groups in {offeringLabel}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmitNewTask)} className="space-y-4 py-1" noValidate>
            <div className="rounded-lg border border-just-blue-100 bg-just-blue-50/40 p-3 space-y-2">
              <Label htmlFor="t-ai-prompt" className="flex items-center gap-1.5 text-just-blue-700">
                <Sparkles size={13} /> Generate with AI
              </Label>
              <textarea
                id="t-ai-prompt"
                rows={2}
                placeholder={"Describe the task you want to create...\ne.g. 'Create a database normalization task for groups of 5, focusing on 3NF'"}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              {pickedGroups.length >= 2 && (
                <div className="flex flex-col gap-1.5 pt-1 border-t border-just-blue-100">
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="ai-mode"
                      checked={aiMode === 'single'}
                      onChange={() => setAiMode('single')}
                      className="mt-0.5 accent-just-blue-600"
                    />
                    <span className="text-ink-700">Same task for all selected groups</span>
                  </label>
                  <label className="flex items-start gap-2 text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="ai-mode"
                      checked={aiMode === 'variations'}
                      onChange={() => setAiMode('variations')}
                      className="mt-0.5 accent-just-blue-600"
                    />
                    <div>
                      <span className="text-ink-700">Different variation for each group</span>
                      <p className="text-ink-400">
                        AI creates a unique scenario per group with the same difficulty — helps prevent copying.
                      </p>
                    </div>
                  </label>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-ink-400">AI fills the form — you review and edit before saving.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 shrink-0"
                  disabled={aiPrompt.trim().length < 10 || (isVariationsMode ? generatingVariations : generating)}
                  onClick={handleGenerateWithAI}
                >
                  {(isVariationsMode ? generatingVariations : generating)
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Sparkles size={13} />}
                  {isVariationsMode
                    ? (generatingVariations ? `Generating ${pickedGroups.length} variations...` : 'Generate with AI')
                    : (generating ? 'Generating...' : 'Generate with AI')}
                </Button>
              </div>
              {aiError && <p className="text-xs text-danger">{aiError}</p>}
            </div>
            {isVariationsMode ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Task variations {variations ? `(${variations.length})` : ''}</Label>
                  <button
                    type="button"
                    onClick={handleBackToSingle}
                    className="text-xs text-just-blue-600 hover:underline"
                  >
                    Back to single task
                  </button>
                </div>
                {!variations ? (
                  <p className="text-sm text-ink-400">
                    Click "Generate with AI" above to create a unique variation for each selected group.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {variations.map((v, i) => (
                      <div key={v.groupId} className="rounded-md border border-border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">{v.groupName}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1 text-just-blue-600 hover:text-just-blue-700"
                            disabled={regeneratingGroupId === v.groupId}
                            onClick={() => handleRegenerateOne(i)}
                          >
                            {regeneratingGroupId === v.groupId
                              ? <Loader2 size={12} className="animate-spin" />
                              : <RefreshCw size={12} />}
                            Regenerate
                          </Button>
                        </div>
                        <Input
                          value={v.title}
                          onChange={(e) => updateVariationField(i, 'title', e.target.value)}
                          placeholder="Title"
                        />
                        <textarea
                          rows={3}
                          value={v.description}
                          onChange={(e) => updateVariationField(i, 'description', e.target.value)}
                          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                          placeholder="Description"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="t-deadline">Deadline <span className="text-danger">*</span></Label>
              <div className="relative">
                <Input
                  id="t-deadline"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="pr-9 [&::-webkit-calendar-picker-indicator]:opacity-0"
                  aria-invalid={!!errors.deadline}
                  {...register('deadline', { required: 'Deadline is required' })}
                />
                {errors.deadline && <p className="text-xs text-danger">{errors.deadline.message}</p>}
                <Calendar size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign to groups</Label>
              <GroupPicker groups={groups} selected={pickedGroups} onChange={handleGroupsChange} />
              <p className="text-xs text-ink-400">
                {pickedGroups.length === 0
                  ? 'No groups selected — task will be visible to all groups.'
                  : `${pickedGroups.length} group${pickedGroups.length !== 1 ? 's' : ''} selected.`}
              </p>
            </div>
            {!isVariationsMode && (
              <>
                <div className="space-y-1.5">
                  <Label>Submission type</Label>
                  <div className="flex rounded-md border border-border overflow-hidden text-sm">
                    {['group', 'individual'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSubmissionType(t)}
                        className={cn(
                          'flex-1 py-1.5 text-center capitalize transition-colors',
                          submissionType === t
                            ? 'bg-just-blue-600 text-white font-medium'
                            : 'bg-white text-ink-500 hover:bg-ink-50',
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-ink-400">
                    {submissionType === 'group'
                      ? 'One submission per group — any member can submit on behalf of the group.'
                      : 'Each student submits individually — every member must submit their own work.'}
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
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetDialog}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isVariationsMode ? (creatingBulk || !variations?.length) : creating}
              >
                {(isVariationsMode ? creatingBulk : creating) && <Loader2 size={14} className="animate-spin" />}
                {isVariationsMode ? `Create ${variations?.length ?? pickedGroups.length} Tasks` : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discard variations confirm */}
      <AlertDialog open={backToSingleConfirmOpen} onOpenChange={setBackToSingleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard variations?</AlertDialogTitle>
            <AlertDialogDescription>
              Switching back to a single task will discard the {variations?.length ?? 0} generated variation{variations?.length !== 1 ? 's' : ''}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBackToSingle}>Discard</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            <div className="space-y-1.5">
              <Label>Submission type</Label>
              <div className="flex rounded-md border border-border overflow-hidden text-sm">
                {['group', 'individual'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEditSubmissionType(t)}
                    className={cn(
                      'flex-1 py-1.5 text-center capitalize transition-colors',
                      editSubmissionType === t
                        ? 'bg-just-blue-600 text-white font-medium'
                        : 'bg-white text-ink-500 hover:bg-ink-50',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
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
