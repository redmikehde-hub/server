import { walletService } from '../services/walletService.js';

export const walletController = {
  async getWallet(req, res) {
    try {
      const userId = req.user.id;
      const wallet = await walletService.getWallet(userId);
      res.json(wallet);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getTransactions(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, type } = req.query;
      
      const result = await walletService.getTransactions(
        userId,
        parseInt(page),
        parseInt(limit),
        type
      );
      
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async deposit(req, res) {
    try {
      const userId = req.user.id;
      const { amount, bonusCode } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      const result = await walletService.deposit(userId, parseFloat(amount), bonusCode);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async transferBonus(req, res) {
    try {
      const userId = req.user.id;
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }
      
      const result = await walletService.transferBonusToMain(userId, parseFloat(amount));
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};
