import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { referralController } from '../controllers/referralController.js';

const router = Router();

router.get('/code', authMiddleware, referralController.getReferralCode);
router.post('/reward', authMiddleware, referralController.applyReferralBonus);
router.get('/history', authMiddleware, referralController.getReferralHistory);
router.get('/list', authMiddleware, referralController.getReferrals);

export default router;
