import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let io;

export function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (
          origin.includes('localhost') || 
          origin.includes('127.0.0.1')
        ) {
          return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
      },
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);
    
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined their room`);
    });

    socket.on('leave', (userId) => {
      socket.leave(`user_${userId}`);
      console.log(`👤 User ${userId} left their room`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  return io;
}

export async function broadcastNotification(title, message, type = 'GENERAL', bonusCode = null, bonusCoins = null, createdBy = null) {
  try {
    const broadcast = await prisma.broadcastNotification.create({
      data: {
        title,
        message,
        type,
        bonusCode,
        bonusCoins,
        createdBy
      }
    });

    if (io) {
      io.emit('new_notification', {
        id: broadcast.id,
        title,
        message,
        type,
        bonusCode,
        bonusCoins,
        createdAt: broadcast.createdAt
      });
    }

    return broadcast;
  } catch (error) {
    console.error('Broadcast error:', error);
    throw error;
  }
}

export async function notifyUser(userId, title, message, type = 'GENERAL', data = null) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        data: data ? JSON.stringify(data) : null
      }
    });

    if (io) {
      io.to(`user_${userId}`).emit('new_notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('Notify user error:', error);
    throw error;
  }
}
