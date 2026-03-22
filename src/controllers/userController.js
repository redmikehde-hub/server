import { userService } from '../services/userService.js';

export const userController = {
  async getMe(req, res) {
    try {
      const user = await userService.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      res.json({ user });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ error: 'Failed to fetch user.' });
    }
  },

  async updateProfile(req, res) {
    try {
      const { name, phone } = req.body;
      const updates = {};
      
      if (name) updates.name = name;
      if (phone) {
        const existing = await userService.findByPhone(phone);
        if (existing && existing.id !== req.user.id) {
          return res.status(400).json({ error: 'Phone already in use.' });
        }
        updates.phone = phone;
      }

      const user = await userService.update(req.user.id, updates);
      res.json({ message: 'Profile updated.', user });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile.' });
    }
  },

  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, role, search } = req.query;
      const result = await userService.getAll(
        parseInt(page), 
        parseInt(limit), 
        role || null,
        search || null
      );
      res.json(result);
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({ error: 'Failed to fetch users.' });
    }
  },

  async getById(req, res) {
    try {
      const user = await userService.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }
      res.json({ user });
    } catch (error) {
      console.error('Get user by id error:', error);
      res.status(500).json({ error: 'Failed to fetch user.' });
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const bcrypt = await import('bcryptjs');

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user || !user.password) {
        return res.status(404).json({ error: 'User not found.' });
      }

      const isValid = await bcrypt.compare(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword }
      });

      res.json({ message: 'Password changed successfully.' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password.' });
    }
  },

  async search(req, res) {
    try {
      const { q } = req.query;
      if (!q || q.length < 2) {
        return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
      }
      const users = await userService.search(q);
      res.json({ users });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Failed to search users.' });
    }
  }
};

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
