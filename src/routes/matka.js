import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as matkaController from '../controllers/matkaController.js';

const router = express.Router();

router.get('/round', authenticate, matkaController.getCurrentRound);
router.post('/bet', authenticate, matkaController.placeBet);
router.get('/results', authenticate, matkaController.getResults);
router.get('/my-bets', authenticate, matkaController.getMyBets);
router.post('/resolve', authenticate, matkaController.adminResolveRound);
router.get('/stats', authenticate, matkaController.getStats);

export default router;