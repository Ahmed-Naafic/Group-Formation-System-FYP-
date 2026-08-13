import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { selectCurrentToken } from '@/features/auth/authSlice';
import { notificationApi } from './notificationApi';

// See useChatSocket.js for why this can't just be `?? 'http://localhost:5000'`
// — an empty string (same-origin deployments) must also fall through to
// socket.io-client's own window.location default, which only triggers on
// undefined, not on ''.
const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim() || undefined;

export function useNotificationSocket() {
  const token    = useSelector(selectCurrentToken);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
    });

    socket.on('notification', ({ notification }) => {
      dispatch(
        notificationApi.util.updateQueryData('getNotifications', undefined, (draft) => {
          draft.notifications.unshift(notification);
          draft.unreadCount = (draft.unreadCount ?? 0) + 1;
        }),
      );
    });

    return () => socket.disconnect();
  }, [token, dispatch]);
}
