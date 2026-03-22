import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { bonusController } from '../controllers/bonusController.js';

const router = Router();

router.post('/apply', authMiddleware, bonusController.applyBonusCode);
router.post('/create', authMiddleware, bonusController.createBonusCode);
router.patch('/update/:id', authMiddleware, bonusController.updateBonusCode);
router.delete('/delete/:id', authMiddleware, bonusController.deleteBonusCode);
router.get('/codes', authMiddleware, bonusController.getAllBonusCodes);
router.get('/active', authMiddleware, bonusController.getActiveBonusCodes);

export default router;
