import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as aviatorController from '../controllers/aviatorController.js';

const router = express.Router();

router.get('/state', authenticate, aviatorController.getState);
router.post('/bet', authenticate, aviatorController.placeBet);
router.post('/cashout', authenticate, aviatorController.cashout);
router.get('/history', authenticate, aviatorController.history);

export default router;
