import {
  placeAviatorBet,
  cashOutAviator,
  getAviatorHistory,
  getAviatorStateForUser,
} from '../services/aviatorService.js';

export async function getState(req, res) {
  try {
    res.json({ success: true, state: getAviatorStateForUser(req.user.id) });
  } catch (error) {
    console.error('Aviator state error:', error);
    res.status(500).json({ error: 'Failed to get aviator state' });
  }
}

export async function placeBet(req, res) {
  try {
    const { betAmount, autoCashoutAt } = req.body;
    const result = await placeAviatorBet({
      userId: req.user.id,
      name: req.user.name,
      betAmount: Number(betAmount),
      autoCashoutAt: autoCashoutAt ? Number(autoCashoutAt) : null,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to place aviator bet' });
  }
}

export async function cashout(req, res) {
  try {
    const result = await cashOutAviator({ userId: req.user.id });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to cash out' });
  }
}

export async function history(req, res) {
  try {
    const limit = Number(req.query.limit || 20);
    const items = await getAviatorHistory(req.user.id, limit);
    res.json({ success: true, history: items });
  } catch (error) {
    console.error('Aviator history error:', error);
    res.status(500).json({ error: 'Failed to get aviator history' });
  }
}
