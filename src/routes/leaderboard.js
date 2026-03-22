import { Router } from 'express';
import { leaderboardController } from '../controllers/leaderboardController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/monthly', leaderboardController.getMonthly);
router.get('/top', leaderboardController.getTopUsers);
router.get('/rank/me', authenticate, leaderboardController.getMyRank);
router.get('/rank/:userId', leaderboardController.getUserRank);

export default router;
