import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { selectCurrentToken } from '@/features/auth/authSlice';
import { notificationApi } from './notificationApi';

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

export function useNotificationSocket() {
  const token    = useSelector(selectCurrentToken);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
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
