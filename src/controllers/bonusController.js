import { bonusService } from '../services/bonusService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const bonusController = {
  async applyBonusCode(req, res) {
    try {
      const userId = req.user.id;
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: 'Bonus code is required' });
      }
      
      const result = await bonusService.applyBonusCode(userId, code);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async createBonusCode(req, res) {
    try {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Admin can create bonus codes' });
      }
      
      const { code } = req.body;
      if (!code || code.length < 3) {
        return res.status(400).json({ error: 'Code must be at least 3 characters' });
      }
      
      const result = await bonusService.createBonusCode(req.body, req.user.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async updateBonusCode(req, res) {
    try {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Admin can update bonus codes' });
      }
      
      const { id } = req.params;
      const result = await bonusService.updateBonusCode(id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async deleteBonusCode(req, res) {
    try {
      if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Admin can delete bonus codes' });
      }
      
      const { id } = req.params;
      await bonusService.deleteBonusCode(id);
      res.json({ message: 'Bonus code deleted successfully' });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getAllBonusCodes(req, res) {
    try {
      if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'SUB_ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const codes = await bonusService.getAllBonusCodes();
      res.json({ codes });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getActiveBonusCodes(req, res) {
    try {
      const codes = await bonusService.getActiveBonusCodes();
      res.json({ codes });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      const bonuses = await prisma.bonus.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ bonuses });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch bonuses' });
    }
  },

  async getMyBonuses(req, res) {
    try {
      const claims = await prisma.bonusClaim.findMany({
        where: { userId: req.user.id },
        include: { bonus: true },
        orderBy: { createdAt: 'desc' }
      });
      res.json({ claims });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch bonuses' });
    }
  },

  async validateCode(req, res) {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Code is required' });
      }
      const bonus = await prisma.bonus.findFirst({
        where: { code: code.toUpperCase(), status: 'ACTIVE' }
      });
      if (!bonus) {
        return res.status(404).json({ error: 'Invalid bonus code' });
      }
      res.json({ valid: true, bonus });
    } catch (error) {
      res.status(500).json({ error: 'Failed to validate code' });
    }
  },

  async claimBonus(req, res) {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Code is required' });
      }
      const result = await bonusService.applyBonusCode(req.user.id, code);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getReferralStats(req, res) {
    try {
      const referrals = await prisma.referralReward.count({
        where: { referrerId: req.user.id }
      });
      const totalEarned = await prisma.referralReward.aggregate({
        where: { referrerId: req.user.id },
        _sum: { amount: true }
      });
      res.json({
        referralCount: referrals,
        totalEarnings: totalEarned._sum.amount || 0
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch referral stats' });
    }
  }
};
