import { userService } from '../services/userService.js';

export const adminController = {
  async createSubAdmin(req, res) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'All fields are required.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const existingUser = await userService.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered.' });
      }

      const user = await userService.create({
        name,
        email,
        password,
        role: 'SUB_ADMIN'
      });

      res.status(201).json({
        message: 'Sub-admin created successfully.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Create subadmin error:', error);
      res.status(500).json({ error: 'Failed to create sub-admin.' });
    }
  },

  async getStats(req, res) {
    try {
      const [totalUsers, totalWithdrawals, pendingWithdrawals] = await Promise.all([
        prisma.user.count(),
        prisma.withdrawRequest.count({ where: { status: 'APPROVED' } }),
        prisma.withdrawRequest.count({ where: { status: 'PENDING' } })
      ]);

      const totalWithdrawalAmount = await prisma.withdrawRequest.aggregate({
        where: { status: 'APPROVED' },
        _sum: { amount: true }
      });

      res.json({
        totalUsers,
        totalWithdrawals,
        pendingWithdrawals,
        totalWithdrawalAmount: totalWithdrawalAmount._sum.amount || 0
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: 'Failed to fetch stats.' });
    }
  }
};

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
