const { Server }  = require('socket.io');
const jwt         = require('jsonwebtoken');
const { JWT_SECRET, IS_DEVELOPMENT } = require('../config/env');
const { TOKEN_SCOPES } = require('../modules/auth/services/authService');
const userService      = require('../modules/user/services/userService');
const workspaceService = require('../modules/workspace/services/workspaceService');
const messageService   = require('../modules/chat/services/messageService');
const { buildRequestContext }  = require('../middleware/requestContext');
const { initListeners }        = require('../modules/notification/listeners');
const logger                   = require('../common/utils/logger');

// ── Socket auth middleware ─────────────────────────────────────────────────────

async function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token provided'));

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return next(new Error('Invalid or expired token'));
    }

    if (decoded.scope !== TOKEN_SCOPES.FULL) {
      return next(new Error('Token scope insufficient'));
    }

    const user = await userService.findById(decoded.sub);
    if (!user || !user.isActive) return next(new Error('User not found or deactivated'));

    // Attach context to socket — same shape as req.context
    socket.context = { ...buildRequestContext(decoded, user), fullName: user.fullName };
    next();
  } catch (err) {
    logger.error('Socket auth error', { message: err.message });
    next(new Error('Authentication failed'));
  }
}

// ── Event handlers ─────────────────────────────────────────────────────────────

function roomName(workspaceId) {
  return `workspace:${workspaceId}`;
}

async function handleJoinWorkspace(socket, { workspaceId }) {
  try {
    if (!workspaceId) return socket.emit('error', { message: 'workspaceId required' });
    await workspaceService.getById(workspaceId, socket.context);
    await socket.join(roomName(workspaceId));
    // Mark all messages as read when entering the workspace
    await messageService.markAllRead(workspaceId, socket.context);
    socket.emit('joined-workspace', { workspaceId });
  } catch (err) {
    socket.emit('error', { message: err.message });
  }
}

async function handleLeaveWorkspace(socket, { workspaceId }) {
  await socket.leave(roomName(workspaceId));
}

async function handleSendMessage(io, socket, { workspaceId, content }) {
  try {
    if (!workspaceId || !content?.trim()) {
      return socket.emit('error', { message: 'workspaceId and content are required' });
    }
    const message = await messageService.send(workspaceId, content.trim(), socket.context);
    await message.populate({ path: 'senderId', select: 'fullName role studentId' });
    // Broadcast to everyone in the room (including sender for consistency)
    io.to(roomName(workspaceId)).emit('new-message', { message });
  } catch (err) {
    socket.emit('error', { message: err.message });
  }
}

async function handleMarkRead(io, socket, { workspaceId, messageId }) {
  try {
    if (!workspaceId || !messageId) {
      return socket.emit('error', { message: 'workspaceId and messageId are required' });
    }
    await messageService.markRead(workspaceId, messageId, socket.context);
    io.to(roomName(workspaceId)).emit('message-read', {
      messageId,
      userId: String(socket.context.userId),
    });
  } catch (err) {
    socket.emit('error', { message: err.message });
  }
}

// ── Init ───────────────────────────────────────────────────────────────────────

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: IS_DEVELOPMENT
        ? (origin, cb) => cb(null, true)          // any localhost in dev
        : process.env.ALLOWED_ORIGINS?.split(',') ?? [],
      credentials: true,
    },
  });

  io.use(socketAuthMiddleware);

  // Register notification + audit listeners (need io for real-time push)
  initListeners(io);

  io.on('connection', (socket) => {
    // Auto-join personal room so notifications can be pushed without a client event
    socket.join(`user:${socket.context.userId}`);

    logger.info('Socket connected', {
      socketId: socket.id,
      userId:   String(socket.context.userId),
      role:     socket.context.role,
    });

    socket.on('join-workspace',  (data) => handleJoinWorkspace(socket, data ?? {}));
    socket.on('leave-workspace', (data) => handleLeaveWorkspace(socket, data ?? {}));
    socket.on('send-message',    (data) => handleSendMessage(io, socket, data ?? {}));
    socket.on('mark-read',       (data) => handleMarkRead(io, socket, data ?? {}));

    socket.on('typing', ({ workspaceId } = {}) => {
      if (!workspaceId) return;
      socket.to(roomName(workspaceId)).emit('typing', {
        userId:   String(socket.context.userId),
        fullName: socket.context.fullName,
      });
    });

    socket.on('stop-typing', ({ workspaceId } = {}) => {
      if (!workspaceId) return;
      socket.to(roomName(workspaceId)).emit('stop-typing', {
        userId:   String(socket.context.userId),
        fullName: socket.context.fullName,
      });
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { socketId: socket.id, reason });
    });
  });

  return io;
}

module.exports = { initSocket };
