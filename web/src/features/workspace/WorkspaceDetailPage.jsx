import { useState, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Loader2, Crown, ArrowLeft, Send, Paperclip, Download, Trash2,
  File as FileIcon, FileText, FileImage,
} from 'lucide-react';
import { toast } from 'sonner';
import { selectRole, selectCurrentUser, selectCurrentToken } from '@/features/auth/authSlice';
import { useGetWorkspaceByIdQuery, useGetMessagesQuery } from './workspaceApi';
import { useGetFilesQuery, useUploadFileMutation, useDeleteFileMutation } from './fileApi';
import { useChatSocket } from './useChatSocket';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  { key: 'members', label: 'Members' },
  { key: 'chat',    label: 'Chat'    },
  { key: 'files',   label: 'Files'   },
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

  return (
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
                {isLeader && <Crown size={13} style={{ color: 'var(--just-gold-400)' }} />}
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
  const cls      = group?.classId;
  const course   = group?.courseId;
  const semester = cls?.semesterId;

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
          {course && (
            <>
              {' · '}{course.name}
              {course.code && <span className="font-mono text-xs text-ink-400 ml-1">({course.code})</span>}
            </>
          )}
        </p>
        <h2 className="text-ink-900 mb-0.5">{group?.name ?? '—'}</h2>
        {semester && (
          <p className="text-sm text-ink-400">{semester.name} · {semester.year}</p>
        )}
      </div>

      {/* Tabs */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === 'members' && <MembersTab workspace={workspace} />}

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
    </div>
  );
}
