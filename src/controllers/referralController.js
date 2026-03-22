import { referralService } from '../services/referralService.js';

export const referralController = {
  async getReferralCode(req, res) {
    try {
      const userId = req.user.id;
      const result = await referralService.getReferralCode(userId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async applyReferralBonus(req, res) {
    try {
      const userId = req.user.id;
      const { referredId } = req.body;
      
      if (!referredId) {
        return res.status(400).json({ error: 'Referred user ID is required' });
      }
      
      const result = await referralService.applyReferralBonus(userId, referredId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getReferralHistory(req, res) {
    try {
      const userId = req.user.id;
      const history = await referralService.getReferralHistory(userId);
      res.json({ history });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getReferrals(req, res) {
    try {
      const userId = req.user.id;
      const referrals = await referralService.getReferrals(userId);
      res.json({ referrals });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};
