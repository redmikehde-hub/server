import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as sportPredictionController from '../controllers/sportPredictionController.js';

const router = express.Router();

router.get('/matches', authenticate, sportPredictionController.getMatches);
router.post('/bet', authenticate, sportPredictionController.placeBet);
router.get('/my-bets', authenticate, sportPredictionController.getMyBets);

export default router;
