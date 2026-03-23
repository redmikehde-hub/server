import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as ludoController from '../controllers/ludoController.js';

const router = express.Router();

router.post('/start', authenticate, ludoController.startGame);
router.post('/start-multiplayer', authenticate, ludoController.startMultiplayer);
router.get('/history', authenticate, ludoController.getGameHistory);
router.get('/:gameId', authenticate, ludoController.getGameState);
router.post('/:gameId/roll', authenticate, ludoController.rollDice);
router.post('/:gameId/move', authenticate, ludoController.makeMove);
router.post('/:gameId/skip', authenticate, ludoController.skipTurn);
router.post('/:gameId/ai-turn', authenticate, ludoController.aiTurn);
router.post('/:gameId/forfeit', authenticate, ludoController.forfeitGame);

export default router;
