import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { walletController } from '../controllers/walletController.js';

const router = Router();

router.get('/', authMiddleware, walletController.getWallet);
router.get('/transactions', authMiddleware, walletController.getTransactions);
router.post('/deposit', authMiddleware, walletController.deposit);
router.post('/transfer', authMiddleware, walletController.transferBonus);

export default router;
