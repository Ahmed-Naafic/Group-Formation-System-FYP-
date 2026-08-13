import { useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { selectCurrentToken } from '@/features/auth/authSlice';
import { workspaceApi } from './workspaceApi';

// An empty string (same-origin deployments, where VITE_API_BASE_URL is
// intentionally blank so REST calls resolve as relative paths) is NOT the
// same as "unset" to socket.io-client: io('') tries to parse '' as a
// hostname and builds a broken connection target, whereas io(undefined)
// correctly defaults to window.location. `|| undefined` normalizes both
// "unset" and "explicitly blank" to the same safe default.
const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL ?? '').trim() || undefined;

export function useChatSocket(workspaceId) {
  const token     = useSelector(selectCurrentToken);
  const dispatch  = useDispatch();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token || !workspaceId) return;

    // io() returns the cached socket for this URL (shared with useNotificationSocket)
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['polling', 'websocket'] });
    socketRef.current = socket;

    socket.emit('join-workspace', { workspaceId });

    function onNewMessage({ message }) {
      dispatch(
        workspaceApi.util.updateQueryData('getMessages', workspaceId, (draft) => {
          draft.push(message);
        }),
      );
    }

    socket.on('new-message', onNewMessage);

    return () => {
      socket.off('new-message', onNewMessage);
      socket.emit('leave-workspace', { workspaceId });
      socketRef.current = null;
    };
  }, [token, workspaceId, dispatch]);

  const sendMessage = useCallback((content) => {
    socketRef.current?.emit('send-message', { workspaceId, content });
  }, [workspaceId]);

  return { sendMessage };
}
