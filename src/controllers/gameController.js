import { gameService } from '../services/gameService.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const gameController = {
  async playGame(req, res) {
    try {
      const userId = req.user.id;
      const { gameName, gameId, betAmount, selection, multiplier } = req.body;
      
      if (!betAmount || betAmount < 1) {
        return res.status(400).json({ error: 'Minimum bet is 1 coin' });
      }
      
      const result = await gameService.playGame(userId, {
        gameName,
        gameId,
        betAmount: parseFloat(betAmount),
        selection,
        multiplier: parseFloat(multiplier) || 2
      });
      
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getGameHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      
      const result = await gameService.getGameHistory(
        userId,
        parseInt(page),
        parseInt(limit)
      );
      
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getUserStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await gameService.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      const { category, page = 1, limit = 20 } = req.query;
      const where = category ? { category } : {};
      
      const [games, total] = await Promise.all([
        prisma.game.findMany({
          where: { ...where, isActive: true },
          skip: (page - 1) * limit,
          take: parseInt(limit),
          orderBy: { isFeatured: 'desc' }
        }),
        prisma.game.count({ where: { ...where, isActive: true } })
      ]);
      
      res.json({ games, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
      console.error('Error fetching games:', error);
      res.status(500).json({ error: 'Failed to fetch games', details: error.message });
    }
  },

  async getCategories(req, res) {
    try {
      const categories = await prisma.game.groupBy({
        by: ['category'],
        where: { isActive: true },
        _count: { id: true }
      });
      
      res.json({ 
        categories: categories.map(c => ({ 
          name: c.category, 
          count: c._count.id 
        })) 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  },

  async getFeatured(req, res) {
    try {
      const games = await prisma.game.findMany({
        where: { isActive: true, isFeatured: true },
        take: 10,
        orderBy: { views: 'desc' }
      });
      
      res.json({ games });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch featured games' });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const game = await prisma.game.findUnique({
        where: { id }
      });
      
      if (!game) {
        return res.status(404).json({ error: 'Game not found' });
      }
      
      await prisma.game.update({
        where: { id: game.id },
        data: { views: { increment: 1 } }
      }).catch(() => {});
      
      res.json({ game });
    } catch (error) {
      console.error('Get game by ID error:', error);
      res.status(500).json({ error: 'Failed to fetch game' });
    }
  },

  async create(req, res) {
    try {
      const game = await prisma.game.create({ data: req.body });
      res.status(201).json({ game });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create game' });
    }
  },

  async update(req, res) {
    try {
      const game = await prisma.game.update({
        where: { id: req.params.id },
        data: req.body
      });
      res.json({ game });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update game' });
    }
  }
};
