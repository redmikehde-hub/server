import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { gameController } from '../controllers/gameController.js';

const router = Router();

router.post('/play', authMiddleware, gameController.playGame);
router.get('/history', authMiddleware, gameController.getGameHistory);
router.get('/stats', authMiddleware, gameController.getUserStats);

export default router;
