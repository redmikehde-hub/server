import { Router } from 'express';
import { bonusController } from '../controllers/bonusController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', bonusController.getAll);
router.get('/my', authenticate, bonusController.getMyBonuses);
router.post('/validate', authenticate, bonusController.validateCode);
router.post('/claim', authenticate, bonusController.claimBonus);
router.get('/referral', authenticate, bonusController.getReferralStats);

export default router;
