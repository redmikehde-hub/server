import express from 'express';
import { broadcastController } from '../controllers/broadcastController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', authenticate, broadcastController.getForUser);
router.get('/all', authenticate, broadcastController.getAll);
router.get('/unread-count', authenticate, broadcastController.getUnreadCount);
router.patch('/:id/read', authenticate, broadcastController.markRead);
router.patch('/read-all', authenticate, broadcastController.markAllRead);
router.post('/', authenticate, broadcastController.create);

export default router;
