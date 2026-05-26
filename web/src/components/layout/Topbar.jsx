import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Moon, Sun, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { clearCredentials, selectCurrentUser, selectRole } from '@/features/auth/authSlice';
import { baseApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';
import { useGetNotificationsQuery } from '@/features/notification/notificationApi';

export default function Topbar({ title, onMenuClick }) {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const user      = useSelector(selectCurrentUser);
  const role      = useSelector(selectRole);
  const { isDark, toggle } = useTheme();
  const { data: notifData } = useGetNotificationsQuery();
  const unreadCount = notifData?.unreadCount ?? 0;

  function handleLogout() {
    dispatch(clearCredentials());
    dispatch(baseApi.util.resetApiState());
    navigate('/login', { replace: true });
    toast.success('Signed out successfully');
  }

  return (
    <header
      className="sticky top-0 z-10 flex h-14 items-center gap-4 px-6"
      style={{
        background:   'var(--topbar-bg)',
        borderBottom: '1px solid var(--topbar-border)',
        boxShadow:    'var(--shadow-xs)',
      }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white transition-colors lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>

      {/* Page title */}
      <h1
        className="flex-1 text-white font-semibold leading-none truncate"
        style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h4)' }}
      >
        {title}
      </h1>

      {/* User info + actions */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex flex-col items-end leading-none mr-1">
          <span className="text-sm font-medium text-white">
            {user?.fullName ?? user?.email ?? 'User'}
          </span>
          <span
            className="capitalize mt-0.5"
            style={{ fontSize: 'var(--fs-micro)', color: 'var(--topbar-fg-muted)' }}
          >
            {role}
          </span>
        </div>

        {/* Notification bell */}
        <button
          onClick={() => navigate('/notifications')}
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Notifications"
        >
          <Bell size={16} strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-white font-bold"
              style={{ fontSize: '9px' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark
            ? <Sun size={16} strokeWidth={1.75} />
            : <Moon size={16} strokeWidth={1.75} />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-1.5 text-white/60 hover:text-white hover:bg-white/10"
        >
          <LogOut size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
