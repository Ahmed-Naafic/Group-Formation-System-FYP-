import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Menu, LogOut, Moon, Sun } from 'lucide-react';
import { toast } from 'sonner';
import { clearCredentials, selectCurrentUser, selectRole } from '@/features/auth/authSlice';
import { baseApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

export default function Topbar({ title, onMenuClick }) {
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const user      = useSelector(selectCurrentUser);
  const role      = useSelector(selectRole);
  const { isDark, toggle } = useTheme();

  function handleLogout() {
    dispatch(clearCredentials());
    dispatch(baseApi.util.resetApiState());
    navigate('/login', { replace: true });
    toast.success('Signed out successfully');
  }

  return (
    <header
      className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border bg-card px-6"
      style={{ boxShadow: 'var(--shadow-xs)' }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-muted hover:text-ink-800 transition-colors lg:hidden"
        aria-label="Open navigation"
      >
        <Menu size={20} strokeWidth={1.75} />
      </button>

      {/* Page title */}
      <h1
        className="flex-1 text-ink-900 font-semibold leading-none truncate"
        style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h4)' }}
      >
        {title}
      </h1>

      {/* User info + actions */}
      <div className="flex items-center gap-2">
        <div className="hidden sm:flex flex-col items-end leading-none mr-1">
          <span className="text-sm font-medium text-ink-800">
            {user?.fullName ?? user?.email ?? 'User'}
          </span>
          <span
            className="capitalize mt-0.5"
            style={{ fontSize: 'var(--fs-micro)', color: 'var(--fg-muted)' }}
          >
            {role}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="h-8 w-8 p-0 text-ink-500 hover:text-ink-800"
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
          className="gap-1.5 text-ink-500 hover:text-danger hover:bg-red-50"
        >
          <LogOut size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
