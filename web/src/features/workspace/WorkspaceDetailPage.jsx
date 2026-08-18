import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  Loader2, Crown, ArrowLeft, ArrowRight, Send, Paperclip, Download, Trash2,
  File as FileIcon, FileText, FileImage, FileVideo, ClipboardList, Calendar,
  Star, MessageSquare, Smile, Sticker,
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { toast } from 'sonner';
import { selectRole, selectCurrentUser, selectCurrentToken } from '@/features/auth/authSlice';
import { workspaceApi, useGetWorkspaceByIdQuery, useGetMessagesQuery } from './workspaceApi';
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

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// ── Helpers ────────────────────────────────────────────────────────────────────

// Reports true once the element has scrolled near the viewport — used to
// defer media fetches (images/video/voice) until a bubble is actually about
// to be seen, instead of every message in the loaded page fetching at once.
function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin: '200px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, inView]);
  return inView;
}

function formatTime(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds ?? 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeIcon(mimeType) {
  if (mimeType?.startsWith('image/'))       return FileImage;
  if (mimeType?.startsWith('video/'))       return FileVideo;
  if (mimeType?.includes('pdf'))            return FileText;
  return FileIcon;
}

const EMOJI_ONLY_RE = /\p{Extended_Pictographic}/u;

// Sticker-style rendering (big, no bubble) applies to any attachment-free
// message whose content is only 1-3 emoji — whether typed or sent via the
// sticker picker, matching how WhatsApp treats emoji-only messages.
function isStickerContent(content) {
  const trimmed = content?.trim();
  if (!trimmed) return false;
  const graphemes = typeof Intl !== 'undefined' && Intl.Segmenter
    ? [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(trimmed)].map((s) => s.segment)
    : [...trimmed];
  if (graphemes.length === 0 || graphemes.length > 3) return false;
  return graphemes.every((g) => EMOJI_ONLY_RE.test(g));
}

const STICKER_EMOJIS = [
  '😀', '😂', '🥹', '😍', '😎', '🥳', '😢', '😭', '😡', '🤔',
  '👍', '👎', '👏', '🙏', '❤️', '💔', '🔥', '🎉', '✨', '💯',
  '👌', '🙌', '🤝', '😴', '🤯', '😱', '😇', '🥰', '😜', '🤩',
  '😅', '🙄', '😬', '🤗', '👋', '💪', '🌟', '✅', '❌', '🎁',
];

// Lightweight custom popover (no @radix-ui/react-popover in the project) —
// just a positioned panel that closes on outside click.
function usePopoverClose(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);
  return ref;
}

function EmojiPopover({ open, onPick, onClose }) {
  const ref = usePopoverClose(open, onClose);
  if (!open) return null;
  return (
    <div ref={ref} className="absolute bottom-full left-0 mb-2 z-50 rounded-lg shadow-lg overflow-hidden">
      <EmojiPicker onEmojiClick={(e) => onPick(e.emoji)} emojiStyle="native" height={360} width={320} />
    </div>
  );
}

function StickerPopover({ open, onPick, onClose }) {
  const ref = usePopoverClose(open, onClose);
  if (!open) return null;
  return (
    <div ref={ref} className="absolute bottom-full left-0 mb-2 z-50 w-72 max-h-72 overflow-y-auto rounded-lg border border-border bg-white shadow-lg p-2 grid grid-cols-6 gap-1">
      {STICKER_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="text-3xl leading-none rounded-md py-1.5 hover:bg-ink-100"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// Renders a chat attachment: image/video load via authenticated fetch → blob
// object URL (the storage bucket is private, so a plain <img src> can't
// resolve it); anything else shows as a downloadable file chip.
function AttachmentContent({ attachment, workspaceId, token, isMine, isInstructor }) {
  const anchorRef = useRef(null);
  const inView = useInView(anchorRef);
  const [blobUrl, setBlobUrl]   = useState(null);
  const [failed, setFailed]     = useState(false);
  const isImage = attachment.mimeType?.startsWith('image/');
  const isVideo = attachment.mimeType?.startsWith('video/');
  const downloadUrl = `${API_BASE}/api/workspaces/${workspaceId}/files/${attachment._id}/download`;

  // Only image/video need an eager fetch (to render inline) — and only once
  // this bubble has actually scrolled near the viewport, so opening a chat
  // with many media messages doesn't fire a burst of fetches for ones the
  // user hasn't scrolled to yet.
  useEffect(() => {
    if (!inView || (!isImage && !isVideo)) return undefined;
    let cancelled = false;
    let objectUrl;
    (async () => {
      try {
        const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Failed to load');
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setBlobUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [downloadUrl, isImage, isVideo, token, inView]);

  async function handleDownload() {
    try {
      const res = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = attachment.originalName;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      toast.error('Could not download file');
    }
  }

  let content;
  if (isImage) {
    if (failed) {
      content = <div className="w-40 h-28 rounded-lg bg-ink-100 flex items-center justify-center text-xs text-ink-400">Failed to load image</div>;
    } else if (!blobUrl) {
      content = <div className="w-40 h-28 rounded-lg bg-ink-100 flex items-center justify-center">{inView && <Loader2 size={16} className="animate-spin text-ink-300" />}</div>;
    } else {
      content = (
        <img
          src={blobUrl}
          alt={attachment.originalName}
          className="max-w-[240px] max-h-[240px] rounded-lg object-cover cursor-pointer"
          onClick={() => window.open(blobUrl, '_blank')}
        />
      );
    }
  } else if (isVideo) {
    if (failed) {
      content = <div className="w-48 h-28 rounded-lg bg-ink-100 flex items-center justify-center text-xs text-ink-400">Failed to load video</div>;
    } else if (!blobUrl) {
      content = <div className="w-48 h-28 rounded-lg bg-ink-100 flex items-center justify-center">{inView && <Loader2 size={16} className="animate-spin text-ink-300" />}</div>;
    } else {
      content = <video src={blobUrl} controls className="max-w-[260px] max-h-[260px] rounded-lg" />;
    }
  } else {
    content = (
      <button
        type="button"
        onClick={handleDownload}
        className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-left w-56',
          isMine
            ? 'bg-just-blue-700'
            : isInstructor
              ? 'bg-just-gold-100 border border-just-gold-300'
              : 'bg-white border border-border',
        )}
      >
        <DocIcon mimeType={attachment.mimeType} className={isMine ? 'text-white shrink-0' : isInstructor ? 'text-just-gold-700 shrink-0' : 'text-ink-500 shrink-0'} />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm font-medium truncate', isMine ? 'text-white' : isInstructor ? 'text-ink-900' : 'text-ink-800')}>
            {attachment.originalName}
          </span>
          <span className={cn('block text-xs', isMine ? 'text-just-blue-100' : isInstructor ? 'text-just-gold-700' : 'text-ink-400')}>
            {formatBytes(attachment.sizeBytes)}
          </span>
        </span>
        <Download size={14} className={isMine ? 'text-white shrink-0' : isInstructor ? 'text-just-gold-600 shrink-0' : 'text-ink-400 shrink-0'} />
      </button>
    );
  }

  return <div ref={anchorRef}>{content}</div>;
}

// Voice messages: unlike file/image attachments, the backend has no download-
// redirect route for these — GET .../messages/:messageId/audio returns a
// short-lived signed URL as JSON instead. Fetched once here (bytes → blob →
// object URL) rather than used directly as <audio src>, so playback doesn't
// break if the user leaves the chat open past the URL's ~5-minute TTL.
function VoiceMessage({ workspaceId, messageId, duration, token, isMine, isInstructor }) {
  const anchorRef = useRef(null);
  const inView = useInView(anchorRef);
  const [audioUrl, setAudioUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!inView) return undefined;
    let cancelled = false;
    let objectUrl;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/messages/${messageId}/audio`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to resolve audio URL');
        const { data } = await res.json();
        const audioRes = await fetch(data.url);
        if (!audioRes.ok) throw new Error('Failed to load audio');
        const blob = await audioRes.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) setAudioUrl(objectUrl);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [workspaceId, messageId, token, inView]);

  const mutedText = isMine ? 'text-just-blue-100' : isInstructor ? 'text-just-gold-700' : 'text-ink-400';

  let content;
  if (failed) {
    content = <p className={cn('text-xs', mutedText)}>Failed to load voice message</p>;
  } else if (!audioUrl) {
    content = (
      <div className="flex items-center gap-2 w-56 h-9">
        {inView && <Loader2 size={16} className={cn('animate-spin', mutedText)} />}
        <span className={cn('text-xs', mutedText)}>
          {inView ? 'Loading voice message…' : (duration != null ? formatDuration(duration) : 'Voice message')}
        </span>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-0.5 w-64 max-w-full">
        <audio controls src={audioUrl} className="h-9 w-full" />
        {duration != null && (
          <span className={cn('text-[10px]', mutedText)}>{formatDuration(duration)}</span>
        )}
      </div>
    );
  }

  return <div ref={anchorRef}>{content}</div>;
}

function DocIcon({ mimeType, className }) {
  // fileTypeIcon always returns one of a fixed set of stable icon components
  // (never a freshly-defined one), so this doesn't actually reset state on
  // re-render — safe to silence the compiler's conservative heuristic here.
  const Icon = fileTypeIcon(mimeType);
  // eslint-disable-next-line react-hooks/static-components
  return <Icon size={20} className={className} />;
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Chat tab ───────────────────────────────────────────────────────────────────

function ChatTab({ workspaceId, isAdmin, currentUser }) {
  const { data: messages = [], isLoading, error: messagesError } = useGetMessagesQuery(workspaceId);
  const { sendMessage } = useChatSocket(workspaceId);
  const token = useSelector(selectCurrentToken);
  const dispatch = useDispatch();

  const [text,       setText]       = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [emojiOpen,  setEmojiOpen]  = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);
  // Tracks the message ids at each end so the layout effect below can tell
  // "a message landed at the bottom" (follow it) apart from "older messages
  // were prepended at the top" (restore position instead of jumping down).
  const edgeIdsRef = useRef({ firstId: null, lastId: null });
  const pendingOlderScrollRef = useRef(null);

  // Runs synchronously after the DOM commits (before paint), so there's no
  // visible flash of the wrong scroll position either way.
  useLayoutEffect(() => {
    const firstId = messages[0]?._id ?? null;
    const lastId  = messages[messages.length - 1]?._id ?? null;
    const prev = edgeIdsRef.current;
    const container = containerRef.current;

    if (pendingOlderScrollRef.current && firstId !== prev.firstId) {
      const { scrollTop, scrollHeight } = pendingOlderScrollRef.current;
      if (container) container.scrollTop = scrollTop + (container.scrollHeight - scrollHeight);
      pendingOlderScrollRef.current = null;
    } else if (lastId !== prev.lastId) {
      if (container) container.scrollTop = container.scrollHeight;
    }

    edgeIdsRef.current = { firstId, lastId };
  }, [messages]);

  async function loadOlderMessages() {
    if (loadingOlder || !hasMoreOlder || messages.length === 0) return;
    const container = containerRef.current;
    setLoadingOlder(true);
    try {
      const oldestId = messages[0]._id;
      const res = await fetch(
        `${API_BASE}/api/workspaces/${workspaceId}/messages?before=${oldestId}&limit=50`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error('Failed to load older messages');
      const body = await res.json();
      const older = body.data?.messages ?? [];
      if (older.length < 50) setHasMoreOlder(false);
      if (older.length > 0) {
        if (container) {
          pendingOlderScrollRef.current = {
            scrollTop: container.scrollTop,
            scrollHeight: container.scrollHeight,
          };
        }
        dispatch(
          workspaceApi.util.updateQueryData('getMessages', workspaceId, (draft) => {
            draft.unshift(...older);
          }),
        );
      }
    } catch {
      // Silent — the user can just scroll again to retry, same as any other
      // background refetch failure elsewhere in this app.
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleScroll() {
    if (containerRef.current && containerRef.current.scrollTop < 80) {
      loadOlderMessages();
    }
  }

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

  function handleEmojiPick(emoji) {
    setText((t) => t + emoji);
  }

  function handleStickerPick(emoji) {
    sendMessage(emoji);
    setStickerOpen(false);
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}/messages/attachment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? 'Upload failed');
      }
      // Sent message arrives back through the existing socket 'new-message' listener.
    } catch (err) {
      toast.error(err.message ?? 'Could not send attachment');
    } finally {
      setUploading(false);
    }
  }

  const myId = String(currentUser?._id ?? currentUser?.id ?? '');

  return (
    <div className="flex flex-col rounded-lg border border-border bg-white shadow-xs overflow-hidden"
      style={{ height: '520px' }}>

      {/* Messages area */}
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-ink-300" />
          </div>
        ) : messagesError ? (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <p className="text-sm text-danger">
              {messagesError?.data?.error?.message ?? 'Could not load messages.'}
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-sm text-ink-400">No messages yet.</p>
            {!isAdmin && <p className="text-xs text-ink-300">Be the first to say something!</p>}
          </div>
        ) : (
          <>
            {loadingOlder && (
              <div className="flex justify-center py-2">
                <Loader2 size={16} className="animate-spin text-ink-300" />
              </div>
            )}
            {messages.map((msg) => {
            const isMine = myId && String(msg.senderId?._id ?? msg.senderId) === myId;
            // Instructor messages get a distinct gold treatment (except when
            // it's the instructor's own view of their own message — that
            // stays the normal "mine" blue, as with any sender).
            const isInstructor = !isMine && msg.senderId?.role === 'instructor';
            const hasAttachment = msg.attachments?.length > 0;
            const hasAudio = !hasAttachment && msg.audioDuration != null;
            const sticker = !hasAttachment && !hasAudio && isStickerContent(msg.content);
            const bubbleClass = cn(
              'rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words',
              isMine
                ? 'bg-just-blue-600 text-white rounded-br-sm'
                : isInstructor
                  ? 'bg-just-gold-100 text-ink-900 border border-just-gold-300 rounded-bl-sm'
                  : 'bg-ink-100 text-ink-800 rounded-bl-sm',
            );
            return (
              <div key={msg._id} className={cn('flex gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}>
                {/* Avatar */}
                {!isMine && (
                  <div className={cn(
                    'shrink-0 h-7 w-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold mt-0.5',
                    isInstructor ? 'bg-just-gold-200 text-just-gold-700' : 'bg-just-blue-100 text-just-blue-700',
                  )}>
                    {msg.senderId?.avatarUrl
                      ? <img src={msg.senderId.avatarUrl} alt={msg.senderId.fullName} className="h-full w-full object-cover" />
                      : (msg.senderId?.fullName ?? '?').charAt(0).toUpperCase()
                    }
                  </div>
                )}
                <div className={cn('max-w-[72%]', isMine ? 'items-end' : 'items-start', 'flex flex-col gap-0.5')}>
                  {!isMine && (
                    <span className={cn(
                      'text-[11px] font-medium ml-1',
                      isInstructor ? 'text-just-gold-700' : 'text-ink-400',
                    )}>
                      {msg.isBroadcast ? '📢 Announcement · ' : ''}{msg.senderId?.fullName ?? '—'}{isInstructor ? ' · Instructor' : ''}
                    </span>
                  )}
                  {hasAttachment ? (
                    <div className="flex flex-col gap-1">
                      <AttachmentContent
                        attachment={msg.attachments[0]}
                        workspaceId={workspaceId}
                        token={token}
                        isMine={isMine}
                        isInstructor={isInstructor}
                      />
                      {msg.content && (
                        <div className={bubbleClass}>
                          {msg.content}
                        </div>
                      )}
                    </div>
                  ) : hasAudio ? (
                    <VoiceMessage
                      workspaceId={workspaceId}
                      messageId={msg._id}
                      duration={msg.audioDuration}
                      token={token}
                      isMine={isMine}
                      isInstructor={isInstructor}
                    />
                  ) : sticker ? (
                    <div className="text-5xl leading-none px-1">{msg.content}</div>
                  ) : (
                    <div className={bubbleClass}>
                      {msg.content}
                    </div>
                  )}
                  <span className="text-[10px] text-ink-300 mx-1">{formatTime(msg.createdAt)}</span>
                </div>
              </div>
            );
            })}
          </>
        )}
      </div>

      {/* Input */}
      {!isAdmin && (
        <div className="border-t border-border px-3 py-2.5 flex items-end gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
            hidden
            onChange={handleFileSelected}
          />
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-9 w-9 p-0"
              onClick={() => { setStickerOpen((v) => !v); setEmojiOpen(false); }}
              aria-label="Stickers"
            >
              <Sticker size={16} />
            </Button>
            <StickerPopover open={stickerOpen} onPick={handleStickerPick} onClose={() => setStickerOpen(false)} />
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 h-9 w-9 p-0"
              onClick={() => { setEmojiOpen((v) => !v); setStickerOpen(false); }}
              aria-label="Emoji"
            >
              <Smile size={16} />
            </Button>
            <EmojiPopover open={emojiOpen} onPick={handleEmojiPick} onClose={() => setEmojiOpen(false)} />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-9 w-9 p-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach file"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
          </Button>
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
            <p className={cn('inline-flex items-center gap-1 text-xs mt-1', isLocked ? 'text-ink-400' : deadlineColor(task.deadline))}>
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
