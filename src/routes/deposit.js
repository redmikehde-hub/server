import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { depositController } from '../controllers/depositController.js';

const router = Router();

router.get('/plans', authMiddleware, depositController.getPlans);
router.post('/purchase', authMiddleware, depositController.purchasePlan);

export default router;
