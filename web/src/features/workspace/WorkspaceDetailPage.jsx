import { useState, useRef, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Loader2, Crown, ArrowLeft, ArrowRight, Send, Paperclip, Download, Trash2,
  File as FileIcon, FileText, FileImage, ClipboardList, Calendar, Eye, EyeOff,
  Star, MessageSquare, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { selectRole, selectCurrentUser, selectCurrentToken } from '@/features/auth/authSlice';
import { useGetWorkspaceByIdQuery, useGetMessagesQuery } from './workspaceApi';
import { useGetFilesQuery, useUploadFileMutation, useDeleteFileMutation } from './fileApi';
import { useChatSocket } from './useChatSocket';
import {
  useGetTasksQuery,
  useGetMySubmissionQuery,
  useSaveDraftMutation,
  useSubmitTaskMutation,
} from '@/features/task/taskApi';
import { useGetFilesQuery as useGetWsFilesQuery } from './fileApi';
import { useGetFeedbackQuery, useSubmitFeedbackMutation } from '@/features/feedback/feedbackApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCategoryVisibility } from '@/context/CategoryVisibilityContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORY_VARIANT = { HIGH: 'success', MEDIUM: 'default', LOW: 'destructive' };

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(mimeType) {
  if (mimeType?.startsWith('image/'))       return FileImage;
  if (mimeType?.includes('pdf'))            return FileText;
  return FileIcon;
}

// ── Tab bar ────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'members',  label: 'Members'  },
  { key: 'tasks',    label: 'Tasks'    },
  { key: 'chat',     label: 'Chat'     },
  { key: 'files',    label: 'Files'    },
  { key: 'feedback', label: 'Feedback' },
];

function TabBar({ active, onChange }) {
  return (
    <div className="flex border-b border-border mb-6">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            active === t.key
              ? 'border-just-blue-600 text-just-blue-700'
              : 'border-transparent text-ink-500 hover:text-ink-700',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Members tab ────────────────────────────────────────────────────────────────

function MembersTab({ workspace }) {
  const group    = workspace.groupId;
  const leaderId = String(group?.leaderId?._id ?? group?.leaderId);
  const { showCategory, toggleCategory } = useCategoryVisibility();

  return (
    <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-ink-50/50 flex items-center justify-between">
        <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
          Group Members — {group?.memberIds?.length ?? 0}
        </p>
        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-ink-500" onClick={toggleCategory}>
          {showCategory ? <EyeOff size={11} /> : <Eye size={11} />}
          {showCategory ? 'Hide Category' : 'Show Category'}
        </Button>
      </div>
      <div className="divide-y divide-border">
        {group?.memberIds?.map((m) => {
          const isLeader = String(m._id) === leaderId;
          return (
            <div key={m._id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 shrink-0 flex items-center justify-center">
                {isLeader && <Crown size={13} style={{ color: 'var(--just-gold-400)' }} />}
              </span>
              <span className="flex-1 font-medium text-ink-800 text-sm">{m.fullName}</span>
              <span className="font-mono text-xs text-ink-400">{m.userId?.studentId ?? '—'}</span>
              {showCategory && (
                <Badge
                  variant={CATEGORY_VARIANT[m.performanceCategory] ?? 'secondary'}
                  className="text-[10px] px-1.5 py-0 h-4"
                >
                  {m.performanceCategory ?? 'UNGRADED'}
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chat tab ───────────────────────────────────────────────────────────────────

function ChatTab({ workspaceId, isAdmin, currentUser }) {
  const { data: messages = [], isLoading } = useGetMessagesQuery(workspaceId);
  const { sendMessage } = useChatSocket(workspaceId);

  const [text,    setText]   = useState('');
  const containerRef         = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage(trimmed);
    setText('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const myId = String(currentUser?._id ?? currentUser?.id ?? '');

  return (
    <div className="flex flex-col rounded-lg border border-border bg-white shadow-xs overflow-hidden"
      style={{ height: '520px' }}>

      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm text-ink-400">No messages yet.</p>
            {!isAdmin && <p className="text-xs text-ink-300">Be the first to say something!</p>}
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = myId && String(msg.senderId?._id ?? msg.senderId) === myId;
            return (
              <div key={msg._id} className={cn('flex gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
                {/* Avatar */}
                {!isMine && (
                  <div className="shrink-0 h-7 w-7 rounded-full bg-just-blue-100 flex items-center justify-center text-[10px] font-bold text-just-blue-700 mt-0.5">
                    {(msg.senderId?.fullName ?? '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={cn('max-w-[72%]', isMine ? 'items-end' : 'items-start', 'flex flex-col gap-0.5')}>
                  {!isMine && (
                    <span className="text-[11px] text-ink-400 font-medium ml-1">
                      {msg.senderId?.fullName ?? '—'}
                    </span>
                  )}
                  <div className={cn(
                    'rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words',
                    isMine
                      ? 'bg-just-blue-600 text-white rounded-br-sm'
                      : 'bg-ink-100 text-ink-800 rounded-bl-sm',
                  )}>
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-ink-300 mx-1">{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      {!isAdmin && (
        <div className="border-t border-border px-3 py-2.5 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Type a message… (Enter to send)"
            className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-h-28 overflow-y-auto"
            style={{ minHeight: '38px' }}
          />
          <Button
            size="sm"
            className="shrink-0 h-9 w-9 p-0"
            onClick={handleSend}
            disabled={!text.trim()}
            aria-label="Send message"
          >
            <Send size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Instructor tasks tab (read-only — no submission form) ─────────────────────

function InstructorTasksTab({ courseOfferingId, groupId }) {
  const navigate = useNavigate();
  const token    = useSelector(selectCurrentToken);
  const { data: rawTasks = [], isLoading, error } = useGetTasksQuery(courseOfferingId);

  const tasks = rawTasks.filter((t) =>
    t.assignedGroups.length === 0 ||
    t.assignedGroups.some((g) => String(g._id ?? g) === groupId),
  );

  async function downloadAttachment(task) {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${task._id}/attachment`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let msg = 'Could not download attachment';
        try { msg = (await res.json())?.error?.message ?? msg; } catch { /* */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href  = URL.createObjectURL(blob);
      link.download = task.attachments[0].originalName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.error(err.message ?? 'Could not download attachment');
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-ink-300" />
      </div>
    );
  }
  if (error) {
    return <p className="text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load tasks.'}</p>;
  }
  if (!tasks.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white py-14 flex flex-col items-center gap-2">
        <ClipboardList size={28} className="text-ink-200" />
        <p className="text-sm text-ink-400">No tasks assigned to this group yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const now      = new Date();
        const deadline = task.deadline ? new Date(task.deadline) : null;
        const overdue  = deadline && task.status === 'open' && deadline < now;
        const dueSoon  = deadline && !overdue && (deadline - now) < 3 * 86400000;
        const deadlineColor = overdue ? 'text-danger' : dueSoon ? 'text-[var(--fg-warning)]' : 'text-ink-400';

        return (
          <div
            key={task._id}
            className="rounded-lg border border-border bg-white shadow-xs px-5 py-4 flex items-start gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-semibold text-ink-800 text-sm">{task.title}</span>
                <Badge variant={task.status === 'open' ? 'success' : 'secondary'}>
                  {task.status === 'open' ? 'Open' : 'Closed'}
                </Badge>
              </div>
              {task.description && (
                <p className="text-xs text-ink-500 line-clamp-2 mb-1">{task.description}</p>
              )}
              {deadline && (
                <p className={cn('inline-flex items-center gap-1 text-xs', deadlineColor)}>
                  <Calendar size={11} />
                  {deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {overdue ? ' — overdue' : ''}
                </p>
              )}
              {task.attachments?.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadAttachment(task)}
                  className="inline-flex items-center gap-1 text-xs text-just-blue-600 hover:underline mt-1"
                >
                  <Paperclip size={11} />
                  {task.attachments[0].originalName}
                  <Download size={10} />
                </button>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-just-blue-600 hover:text-just-blue-700 shrink-0"
              onClick={() => navigate(`/tasks/${task._id}/submissions`, { state: { offeringId: courseOfferingId } })}
            >
              Submissions <ArrowRight size={11} />
            </Button>
          </div>
        );
      })}
    </div>
  );
}

// ── Tasks tab ─────────────────────────────────────────────────────────────────

const SUBMISSION_STATUS = {
  draft:     { label: 'Draft',         variant: 'secondary' },
  submitted: { label: 'Submitted',     variant: 'default'   },
  late:      { label: 'Late',          variant: 'warning'   },
  reviewed:  { label: 'Reviewed',      variant: 'success'   },
};

function deadlineColor(deadline) {
  if (!deadline) return 'text-ink-400';
  const diff = Math.round((new Date(deadline) - Date.now()) / 86400000);
  if (diff < 0)  return 'text-danger';
  if (diff <= 3) return 'text-[var(--fg-warning)]';
  return 'text-ink-400';
}

function formatDeadline(deadline) {
  if (!deadline) return null;
  return new Date(deadline).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StudentTaskCard({ task, workspaceId }) {
  const { data: submission, isLoading: loadingSub } = useGetMySubmissionQuery(task._id);
  const [saveDraft,   { isLoading: saving }]    = useSaveDraftMutation();
  const [submitTask,  { isLoading: submitting }] = useSubmitTaskMutation();
  const [notes, setNotes] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const token = useSelector(selectCurrentToken);
  const { data: wsFiles = [] } = useGetWsFilesQuery(workspaceId);

  async function handleDownloadAttachment() {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${task._id}/attachment`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        let msg = 'Could not download attachment';
        try { msg = (await res.json())?.error?.message ?? msg; } catch { /* */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href  = URL.createObjectURL(blob);
      link.download = task.attachments[0].originalName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      toast.error(err.message ?? 'Could not download attachment');
    }
  }

  // Pre-fill notes and selected files from existing draft when it loads
  useEffect(() => {
    if (submission?.notes) setNotes(submission.notes);
    if (submission?.files?.length) setSelectedFileIds(submission.files.map((f) => String(f._id ?? f)));
  }, [submission?.notes, submission?.files]);

  const isLocked = submission && ['submitted', 'late', 'reviewed'].includes(submission.status);
  const taskOpen = task.status === 'open';

  function toggleFile(id) {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSaveDraft() {
    try {
      await saveDraft({ taskId: task._id, notes, fileIds: selectedFileIds }).unwrap();
      toast.success('Draft saved');
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to save draft');
    }
  }

  async function handleSubmit() {
    try {
      await submitTask({ taskId: task._id, notes, fileIds: selectedFileIds }).unwrap();
      toast.success('Task submitted');
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to submit');
    }
  }

  return (
    <div className="rounded-lg border border-border bg-white shadow-xs px-5 py-4">
      {/* Task header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink-800 text-sm">{task.title}</span>
            <Badge variant={task.status === 'open' ? 'success' : 'secondary'} className="text-[10px]">
              {task.status === 'open' ? 'Open' : 'Closed'}
            </Badge>
            <Badge variant={task.submissionType === 'individual' ? 'outline' : 'secondary'} className="text-[10px]">
              {task.submissionType === 'individual' ? 'Individual' : 'Group'}
            </Badge>
            {/* Submission status */}
            {loadingSub ? (
              <Loader2 size={11} className="animate-spin text-ink-300" />
            ) : submission ? (
              <Badge variant={SUBMISSION_STATUS[submission.status]?.variant ?? 'secondary'}>
                {SUBMISSION_STATUS[submission.status]?.label ?? submission.status}
              </Badge>
            ) : (
              <Badge variant="secondary">Not Started</Badge>
            )}
          </div>
          {task.description && (
            <p className="text-xs text-ink-500 mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.deadline && (
            <p className={cn('inline-flex items-center gap-1 text-xs mt-1', deadlineColor(task.deadline))}>
              <Calendar size={11} />
              Due {formatDeadline(task.deadline)}
            </p>
          )}
          {task.attachments?.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadAttachment}
              className="inline-flex items-center gap-1 text-xs text-just-blue-600 hover:underline mt-1"
            >
              <Paperclip size={11} />
              {task.attachments[0].originalName}
              <Download size={10} />
            </button>
          )}
        </div>
        {/* Grade pill */}
        {submission?.grade != null && (
          <span className="shrink-0 text-sm font-bold text-success">
            {submission.grade}/100
          </span>
        )}
      </div>

      {/* Notes + actions — only when task is open and not locked */}
      {taskOpen && !isLocked && (
        <div className="mt-3 space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add notes for your submission (optional)…"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          {wsFiles.length > 0 && (
            <div className="rounded-md border border-border bg-ink-50/50 p-3">
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-2">
                Attach workspace files
              </p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {wsFiles.map((f) => {
                  const checked = selectedFileIds.includes(String(f._id));
                  return (
                    <label key={f._id} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFile(String(f._id))}
                        className="h-3.5 w-3.5 accent-just-blue-600"
                      />
                      <FileIcon size={12} className="text-ink-400 shrink-0" />
                      <span className="text-xs text-ink-700 truncate group-hover:text-just-blue-600">
                        {f.originalName}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={saving || submitting}
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Save Draft
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={saving || submitting}
            >
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Submit
            </Button>
          </div>
        </div>
      )}

      {/* For group tasks: show who submitted on behalf of the group */}
      {isLocked && task.submissionType !== 'individual' && submission?.submittedBy?.fullName && (
        <div className="mt-3 rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-500">
          Submitted by <span className="font-semibold text-ink-700">{submission.submittedBy.fullName}</span>
        </div>
      )}

      {/* Show saved notes read-only after submission */}
      {isLocked && submission?.notes && (
        <div className="mt-3 rounded-md bg-ink-50 px-3 py-2 text-sm text-ink-600">
          <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide mb-1">Your notes</p>
          {submission.notes}
        </div>
      )}
    </div>
  );
}

function StudentTasksTab({ courseOfferingId, groupId, workspaceId }) {
  const { data: rawTasks = [], isLoading, error } = useGetTasksQuery(courseOfferingId);

  const tasks = rawTasks.filter((t) =>
    t.assignedGroups.length === 0 ||
    t.assignedGroups.some((g) => String(g._id ?? g) === groupId),
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-ink-300" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-danger">{error?.data?.error?.message ?? 'Failed to load tasks.'}</p>;
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white py-14 flex flex-col items-center gap-2">
        <ClipboardList size={28} className="text-ink-200" />
        <p className="text-sm text-ink-400">No tasks assigned to your group yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <StudentTaskCard key={task._id} task={task} workspaceId={workspaceId} />
      ))}
    </div>
  );
}

// ── Files tab ──────────────────────────────────────────────────────────────────

function FilesTab({ workspaceId, isAdmin, currentUser, token }) {
  const { data: files = [], isLoading } = useGetFilesQuery(workspaceId);
  const [uploadFile, { isLoading: uploading }] = useUploadFileMutation();
  const [deleteFile, { isLoading: deleting }]  = useDeleteFileMutation();
  const fileInputRef = useRef(null);

  const myId = String(currentUser?._id ?? currentUser?.id ?? '');

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const formData = new FormData();
    formData.append('file', file);
    try {
      await uploadFile({ workspaceId, formData }).unwrap();
      toast.success('File uploaded');
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Upload failed');
    }
  }

  async function handleDelete(fileId) {
    try {
      await deleteFile({ workspaceId, fileId }).unwrap();
      toast.success('File deleted');
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Delete failed');
    }
  }

  async function handleDownload(file) {
    try {
      const url = `${API_BASE}/api/workspaces/${workspaceId}/files/${file._id}/download`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href  = URL.createObjectURL(blob);
      link.download = file.originalName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error('Download failed');
    }
  }

  return (
    <div>
      {/* Upload button */}
      {!isAdmin && (
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading
              ? <Loader2 size={13} className="animate-spin" />
              : <Paperclip size={13} />}
            Upload File
          </Button>
        </div>
      )}

      {/* File list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-ink-300" />
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white py-12 flex flex-col items-center gap-2">
          <FileIcon size={28} className="text-ink-200" />
          <p className="text-sm text-ink-400">No files uploaded yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden divide-y divide-border">
          {files.map((file) => {
            const Icon      = fileTypeIcon(file.mimeType);
            const isMyFile  = myId && String(file.uploadedBy?._id ?? file.uploadedBy) === myId;
            const canDelete = isAdmin || isMyFile;
            return (
              <div key={file._id} className="flex items-center gap-3 px-4 py-3">
                <Icon size={18} className="shrink-0 text-ink-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-800 truncate">{file.originalName}</p>
                  <p className="text-xs text-ink-400">
                    {formatBytes(file.sizeBytes)}
                    {file.uploadedBy?.fullName && ` · ${file.uploadedBy.fullName}`}
                    {file.uploadedAt && ` · ${formatTime(file.uploadedAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-ink-400 hover:text-just-blue-600"
                    onClick={() => handleDownload(file)}
                    aria-label="Download"
                  >
                    <Download size={13} />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-ink-400 hover:text-danger"
                      onClick={() => handleDelete(file._id)}
                      disabled={deleting}
                      aria-label="Delete"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function WorkspaceDetailPage() {
  const { id }      = useParams();
  const role        = useSelector(selectRole);
  const currentUser = useSelector(selectCurrentUser);
  const token       = useSelector(selectCurrentToken);
  const isAdmin     = role === 'admin';

  const [activeTab, setActiveTab] = useState('members');

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
  const offering = group?.courseOfferingId;
  const course   = offering?.courseId;
  const cohort   = offering?.cohortId;
  const semester = offering?.semesterId;

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
          {cohort?.name ?? '—'}
          {course && (
            <>
              {' · '}{course.name}
              {course.code && <span className="font-mono text-xs text-ink-400 ml-1">({course.code})</span>}
            </>
          )}
        </p>
        <h2 className="text-ink-900 mb-0.5">{group?.name ?? '—'}</h2>
        {semester && (
          <p className="text-sm text-ink-400">{semester.name}</p>
        )}
      </div>

      {/* Tabs */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'members' && <MembersTab workspace={workspace} />}

      {activeTab === 'tasks' && (
        role === 'student'
          ? <StudentTasksTab courseOfferingId={String(offering?._id ?? offering)} groupId={String(group?._id)} workspaceId={id} />
          : <InstructorTasksTab courseOfferingId={String(offering?._id ?? offering)} groupId={String(group?._id)} />
      )}

      {activeTab === 'chat' && (
        <ChatTab
          workspaceId={id}
          isAdmin={isAdmin}
          currentUser={currentUser}
        />
      )}

      {activeTab === 'files' && (
        <FilesTab
          workspaceId={id}
          isAdmin={isAdmin}
          currentUser={currentUser}
          token={token}
        />
      )}

      {activeTab === 'feedback' && (
        <FeedbackTab
          groupId={String(group?._id)}
          role={role}
        />
      )}
    </div>
  );
}

// ── Feedback tab ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange, disabled }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className="focus:outline-none"
          aria-label={`${n} star`}
        >
          <Star
            size={20}
            className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-ink-200'}
          />
        </button>
      ))}
    </div>
  );
}

function FeedbackTab({ groupId, role }) {
  const { data: feedbackList = [], isLoading } = useGetFeedbackQuery({ groupId });
  const [submitFeedback, { isLoading: submitting }] = useSubmitFeedbackMutation();
  const [rating,   setRating]  = useState(0);
  const [comment,  setComment] = useState('');

  const canSubmit = role !== 'admin';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!rating) { toast.error('Please select a rating'); return; }
    try {
      await submitFeedback({ groupId, rating, comment: comment || undefined }).unwrap();
      toast.success('Feedback submitted');
      setRating(0);
      setComment('');
    } catch (err) {
      toast.error(err?.data?.error?.message ?? 'Failed to submit feedback');
    }
  }

  return (
    <div className="space-y-5">
      {/* Submit form — students and instructors only */}
      {canSubmit && (
        <div className="rounded-lg border border-border bg-white shadow-xs p-5">
          <p className="text-sm font-semibold text-ink-800 mb-3 flex items-center gap-1.5">
            <MessageSquare size={14} /> Leave Feedback
          </p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <p className="text-xs text-ink-500 mb-1">Rating</p>
              <StarRating value={rating} onChange={setRating} />
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Optional comment…"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <Button type="submit" size="sm" disabled={submitting || !rating}>
              {submitting && <Loader2 size={13} className="animate-spin" />}
              Submit
            </Button>
          </form>
        </div>
      )}

      {/* Feedback list */}
      <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-ink-50/50">
          <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
            Feedback ({feedbackList.length})
          </p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 size={18} className="animate-spin text-ink-300" /></div>
        ) : feedbackList.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <MessageSquare size={28} className="text-ink-200" />
            <p className="text-sm text-ink-400">No feedback yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {feedbackList.map((fb) => (
              <div key={fb._id} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map((n) => (
                      <Star key={n} size={13} className={n <= fb.rating ? 'text-amber-400 fill-amber-400' : 'text-ink-200'} />
                    ))}
                  </div>
                  <span className="text-xs text-ink-400">
                    {fb.fromUserId?.fullName ?? 'Anonymous'}
                    {' · '}
                    {new Date(fb.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                {fb.comment && <p className="text-sm text-ink-600">{fb.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
