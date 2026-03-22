import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const notificationController = {
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, unreadOnly } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const where = { userId: req.user.id };
      if (unreadOnly === 'true') {
        where.isRead = false;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' }
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId: req.user.id, isRead: false } })
      ]);

      res.json({
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({ error: 'Failed to fetch notifications.' });
    }
  },

  async markAsRead(req, res) {
    try {
      const { id } = req.params;

      await prisma.notification.update({
        where: { id },
        data: { isRead: true }
      });

      res.json({ message: 'Notification marked as read.' });
    } catch (error) {
      console.error('Mark as read error:', error);
      res.status(500).json({ error: 'Failed to update notification.' });
    }
  },

  async markAllAsRead(req, res) {
    try {
      await prisma.notification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true }
      });

      res.json({ message: 'All notifications marked as read.' });
    } catch (error) {
      console.error('Mark all as read error:', error);
      res.status(500).json({ error: 'Failed to update notifications.' });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;

      await prisma.notification.delete({
        where: { id }
      });

      res.json({ message: 'Notification deleted.' });
    } catch (error) {
      console.error('Delete notification error:', error);
      res.status(500).json({ error: 'Failed to delete notification.' });
    }
  },

  async deleteAll(req, res) {
    try {
      await prisma.notification.deleteMany({
        where: { userId: req.user.id }
      });

      res.json({ message: 'All notifications deleted.' });
    } catch (error) {
      console.error('Delete all notifications error:', error);
      res.status(500).json({ error: 'Failed to delete notifications.' });
    }
  },

  async getUnreadCount(req, res) {
    try {
      const count = await prisma.notification.count({
        where: { userId: req.user.id, isRead: false }
      });

      res.json({ count });
    } catch (error) {
      console.error('Get unread count error:', error);
      res.status(500).json({ error: 'Failed to get unread count.' });
    }
  }
};

export async function createNotification(userId, type, title, message, data = null) {
  return prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ? JSON.stringify(data) : null
    }
  });
}
