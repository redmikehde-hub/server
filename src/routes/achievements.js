import { Router } from 'express';
import { achievementController } from '../controllers/achievementController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, achievementController.getAll);
router.get('/my', authenticate, achievementController.getMyAchievements);
router.post('/progress', authenticate, achievementController.updateProgress);
router.post('/:achievementId/claim', authenticate, achievementController.claimReward);

export default router;
