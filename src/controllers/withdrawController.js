import { withdrawService, transactionService } from '../services/transactionService.js';
import { userService } from '../services/userService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const withdrawController = {
  async request(req, res) {
    try {
      const { amount, remark } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required.' });
      }

      const user = await userService.findById(req.user.id);
      if (user.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance.' });
      }

      const existingRequest = await withdrawService.getAll('PENDING');
      const hasPending = existingRequest.requests.some(r => r.userId === req.user.id);
      if (hasPending) {
        return res.status(400).json({ error: 'You already have a pending withdrawal request.' });
      }

      const request = await withdrawService.create(req.user.id, amount);

      res.status(201).json({
        message: 'Withdrawal request submitted.',
        request
      });
    } catch (error) {
      console.error('Withdraw request error:', error);
      res.status(500).json({ error: 'Failed to submit withdrawal request.' });
    }
  },

  async getMyRequests(req, res) {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const result = await withdrawService.getUserRequests(req.user.id, parseInt(page), parseInt(limit));
      
      let requests = result.requests;
      if (status) {
        requests = requests.filter(r => r.status === status);
      }

      res.json({ ...result, requests });
    } catch (error) {
      console.error('Get my requests error:', error);
      res.status(500).json({ error: 'Failed to fetch requests.' });
    }
  },

  async getAll(req, res) {
    try {
      const { status, page = 1, limit = 20 } = req.query;
      const result = await withdrawService.getAll(status, parseInt(page), parseInt(limit));
      res.json(result);
    } catch (error) {
      console.error('Get all requests error:', error);
      res.status(500).json({ error: 'Failed to fetch requests.' });
    }
  },

  async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status, remark } = req.body;

      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be APPROVED or REJECTED.' });
      }

      const request = await withdrawService.getById(id);
      if (!request) {
        return res.status(404).json({ error: 'Request not found.' });
      }

      if (request.status !== 'PENDING') {
        return res.status(400).json({ error: 'Request already processed.' });
      }

      await withdrawService.updateStatus(id, status, remark, req.user.id);

      if (status === 'REJECTED') {
        return res.json({ message: 'Withdrawal request rejected.' });
      }

      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (user.balance < request.amount) {
        await withdrawService.updateStatus(id, 'REJECTED', 'Insufficient balance', req.user.id);
        return res.status(400).json({ error: 'User has insufficient balance.' });
      }

      await userService.updateBalance(request.userId, -request.amount, 'balance');
      await transactionService.create(request.userId, 'WITHDRAW', request.amount, remark || 'Withdrawal approved');

      res.json({ message: 'Withdrawal request approved and processed.' });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ error: 'Failed to update request.' });
    }
  }
};
