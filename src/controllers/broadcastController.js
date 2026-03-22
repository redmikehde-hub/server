import { broadcastNotification } from '../services/socketService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const broadcastController = {
  async create(req, res) {
    try {
      const { title, message, type, bonusCode, bonusCoins } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: 'Title and message are required' });
      }

      const broadcast = await broadcastNotification(
        title,
        message,
        type || 'GENERAL',
        bonusCode || null,
        bonusCoins || null,
        req.user?.id || null
      );

      res.status(201).json({
        message: 'Broadcast sent successfully',
        broadcast
      });
    } catch (error) {
      console.error('Create broadcast error:', error);
      res.status(500).json({ error: 'Failed to send broadcast' });
    }
  },

  async getAll(req, res) {
    try {
      const broadcasts = await prisma.broadcastNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      res.json({ broadcasts });
    } catch (error) {
      console.error('Get broadcasts error:', error);
      res.status(500).json({ error: 'Failed to fetch broadcasts' });
    }
  },

  async getForUser(req, res) {
    try {
      const userId = req.user.id;
      
      const broadcasts = await prisma.broadcastNotification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50
      });

      const userReads = await prisma.userBroadcast.findMany({
        where: { userId },
        select: { broadcastId: true }
      });

      const readIds = new Set(userReads.map(r => r.broadcastId));

      const broadcastsWithReadStatus = broadcasts.map(b => ({
        ...b,
        isRead: readIds.has(b.id)
      }));

      res.json({ broadcasts: broadcastsWithReadStatus });
    } catch (error) {
      console.error('Get user broadcasts error:', error);
      res.status(500).json({ error: 'Failed to fetch broadcasts' });
    }
  },

  async markRead(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      await prisma.userBroadcast.upsert({
        where: {
          userId_broadcastId: {
            userId,
            broadcastId: id
          }
        },
        update: { isRead: true },
        create: {
          userId,
          broadcastId: id,
          isRead: true
        }
      });

      res.json({ message: 'Marked as read' });
    } catch (error) {
      console.error('Mark read error:', error);
      res.status(500).json({ error: 'Failed to mark as read' });
    }
  },

  async markAllRead(req, res) {
    try {
      const userId = req.user.id;

      const broadcasts = await prisma.broadcastNotification.findMany({
        select: { id: true }
      });

      for (const broadcast of broadcasts) {
        await prisma.userBroadcast.upsert({
          where: {
            userId_broadcastId: {
              userId,
              broadcastId: broadcast.id
            }
          },
          update: { isRead: true },
          create: {
            userId,
            broadcastId: broadcast.id,
            isRead: true
          }
        });
      }

      res.json({ message: 'All marked as read' });
    } catch (error) {
      console.error('Mark all read error:', error);
      res.status(500).json({ error: 'Failed to mark all as read' });
    }
  },

  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      
      const broadcasts = await prisma.broadcastNotification.findMany({
        select: { id: true }
      });

      const userReads = await prisma.userBroadcast.findMany({
        where: { userId, isRead: true },
        select: { broadcastId: true }
      });

      const readIds = new Set(userReads.map(r => r.broadcastId));
      const unreadCount = broadcasts.filter(b => !readIds.has(b.id)).length;

      res.json({ unreadCount });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  }
};
