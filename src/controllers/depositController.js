import { depositService } from '../services/depositService.js';

export const depositController = {
  async getPlans(req, res) {
    try {
      const plans = await depositService.getPlans();
      res.json({ plans });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async purchasePlan(req, res) {
    try {
      const userId = req.user.id;
      const { planId } = req.body;
      
      if (!planId) {
        return res.status(400).json({ error: 'Plan ID is required' });
      }
      
      const result = await depositService.purchasePlan(userId, planId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};
