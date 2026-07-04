import { useState } from 'react';
import { Bell, Users2, ClipboardList, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  useGetNotificationsQuery,
  useMarkReadMutation,
  useMarkAllReadMutation,
} from './notificationApi';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  GROUP_FORMED:       { icon: Users2,        color: 'text-just-blue-600',  bg: 'bg-just-blue-50' },
  TASK_ASSIGNED:      { icon: ClipboardList, color: 'text-amber-600',       bg: 'bg-amber-50' },
  SUBMISSION_GRADED:  { icon: CheckCircle2,  color: 'text-success',         bg: 'bg-success/10' },
};

function typeConfig(type) {
  return TYPE_CONFIG[type] ?? { icon: Bell, color: 'text-ink-500', bg: 'bg-ink-100' };
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ── Notification item ──────────────────────────────────────────────────────────

function NotificationItem({ notification, onMarkRead }) {
  const cfg  = typeConfig(notification.type);
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-4 px-5 py-4 transition-colors',
        !notification.isRead && 'bg-just-blue-50/40 dark:bg-just-blue-900/10',
      )}
    >
      <div className={cn('mt-0.5 shrink-0 flex h-8 w-8 items-center justify-center rounded-full', cfg.bg)}>
        <Icon size={15} className={cfg.color} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium leading-snug', notification.isRead ? 'text-ink-700' : 'text-ink-900')}>
          {notification.title}
        </p>
        {notification.message && (
          <p className="mt-0.5 text-xs text-ink-500 line-clamp-2">{notification.message}</p>
        )}
        <p className="mt-1 text-[11px] text-ink-400">{timeAgo(notification.createdAt)}</p>
      </div>

      <div className="shrink-0 flex items-center gap-2 ml-2">
        {!notification.isRead && (
          <>
            <span className="h-2 w-2 rounded-full bg-just-blue-500 shrink-0" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-ink-400 hover:text-ink-700 px-2"
              onClick={() => onMarkRead(notification._id)}
            >
              Mark read
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { data, isLoading } = useGetNotificationsQuery();
  const notifications = data?.notifications ?? [];
  const unreadCount   = data?.unreadCount   ?? 0;

  const [filter,     setFilter]              = useState('all');
  const [markRead,   { isLoading: marking }]    = useMarkReadMutation();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllReadMutation();

  const visibleNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  async function handleMarkRead(id) {
    try {
      await markRead(id).unwrap();
    } catch {
      toast.error('Failed to mark as read');
    }
  }

  async function handleMarkAll() {
    try {
      await markAllRead().unwrap();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-ink-900 leading-none">Notifications</h2>
          {unreadCount > 0 && (
            <p className="text-sm text-ink-500 mt-1">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={markingAll}
          >
            {markingAll && <Loader2 size={13} className="animate-spin" />}
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filter pills */}
      {!isLoading && notifications.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          {['all', 'unread'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? 'bg-just-blue-600 text-white'
                  : 'bg-white border border-border text-ink-500 hover:border-just-blue-300 hover:text-just-blue-600'
              }`}
            >
              {f === 'all' ? 'All' : `Unread${unreadCount ? ` (${unreadCount})` : ''}`}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-ink-300" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white py-16 flex flex-col items-center gap-3">
          <Bell size={32} className="text-ink-200" />
          <p className="text-sm text-ink-400">No notifications yet.</p>
        </div>
      ) : visibleNotifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white py-16 flex flex-col items-center gap-3">
          <Bell size={32} className="text-ink-200" />
          <p className="text-sm text-ink-400">No unread notifications.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-white shadow-xs overflow-hidden divide-y divide-border">
          {visibleNotifications.map((n) => (
            <NotificationItem
              key={n._id}
              notification={n}
              onMarkRead={handleMarkRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}
