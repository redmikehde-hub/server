import { Router } from 'express';
import { notificationController } from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, notificationController.getAll);
router.get('/unread-count', authenticate, notificationController.getUnreadCount);
router.patch('/:id/read', authenticate, notificationController.markAsRead);
router.patch('/read-all', authenticate, notificationController.markAllAsRead);
router.delete('/:id', authenticate, notificationController.delete);
router.delete('/', authenticate, notificationController.deleteAll);

export default router;
