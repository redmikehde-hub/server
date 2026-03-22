import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const transactionService = {
  async create(userId, type, amount, remark = null, gameId = null) {
    return prisma.transaction.create({
      data: { userId, type, amount, remark, gameId }
    });
  },

  async getByUser(userId, page = 1, limit = 20, type = null) {
    const skip = (page - 1) * limit;
    const where = { userId };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.transaction.count({ where })
    ]);

    return {
      transactions,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  },

  async getByGame(gameId, page = 1, limit = 20) {
    return this.getByUser(gameId, page, limit);
  }
};

export const withdrawService = {
  async create(userId, amount, paymentMethodId = null) {
    return prisma.withdrawRequest.create({
      data: { 
        userId, 
        amount,
        paymentMethodId
      }
    });
  },

  async getById(id) {
    return prisma.withdrawRequest.findUnique({
      where: { id },
      include: { 
        user: { select: { id: true, name: true, email: true, balance: true } } 
      }
    });
  },

  async getAll(status, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    
    const [requests, total] = await Promise.all([
      prisma.withdrawRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true, balance: true } }
        }
      }),
      prisma.withdrawRequest.count({ where })
    ]);

    return {
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  },

  async updateStatus(id, status, remark = null, processedBy = null) {
    return prisma.withdrawRequest.update({
      where: { id },
      data: { 
        status, 
        remark,
        processedBy,
        processedAt: new Date()
      }
    });
  },

  async getUserRequests(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      prisma.withdrawRequest.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.withdrawRequest.count({ where: { userId } })
    ]);

    return {
      requests,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    };
  }
};
