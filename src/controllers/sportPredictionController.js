import {
  getSportMatches,
  placeSportBet,
  getSportBetHistory,
} from '../services/sportPredictionService.js';
import { isDatabaseUnavailable, logDatabaseWarningOnce, sendDatabaseUnavailable } from '../utils/databaseFallback.js';

export async function getMatches(req, res) {
  try {
    const matches = await getSportMatches(req.user.id);
    res.json({ success: true, matches });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      logDatabaseWarningOnce('sport:get-matches', error);
      return sendDatabaseUnavailable(res, { matches: [] });
    }
    console.error('Get sport matches error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch matches' });
  }
}

export async function placeBet(req, res) {
  try {
    const { matchId, prediction, betAmount } = req.body;
    const result = await placeSportBet(req.user.id, {
      matchId,
      prediction,
      betAmount: Number(betAmount),
    });
    res.json({ success: true, ...result });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      logDatabaseWarningOnce('sport:place-bet', error);
      return sendDatabaseUnavailable(res);
    }
    res.status(400).json({ error: error.message || 'Failed to place sport bet' });
  }
}

export async function getMyBets(req, res) {
  try {
    const limit = Number(req.query.limit || 20);
    const bets = await getSportBetHistory(req.user.id, limit);
    res.json({ success: true, bets });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      logDatabaseWarningOnce('sport:get-bets', error);
      return sendDatabaseUnavailable(res, { bets: [] });
    }
    console.error('Get sport bets error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sport bets' });
  }
}
