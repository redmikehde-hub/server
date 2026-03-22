import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const walletService = {
  async getWallet(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        balance: true,
        bonusBalance: true,
        totalWinnings: true,
        totalDeposited: true,
        totalWithdrawn: true
      }
    });
    
    return {
      coins: user?.balance || 0,
      bonusCoins: user?.bonusBalance || 0,
      totalWinnings: user?.totalWinnings || 0,
      totalDeposited: user?.totalDeposited || 0,
      totalWithdrawn: user?.totalWithdrawn || 0
    };
  },

  async getTransactions(userId, page = 1, limit = 20, type = null) {
    const skip = (page - 1) * limit;
    const where = { userId };
    
    if (type) {
      where.type = type;
    }
    
    const [transactions, total] = await Promise.all([
      prisma.coinTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.coinTransaction.count({ where })
    ]);
    
    return {
      transactions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async deposit(userId, amount, planId = null) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    
    const balanceBefore = user.balance;
    const newBalance = balanceBefore + amount;
    
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: newBalance,
          totalDeposited: { increment: amount }
        }
      });
      
      await tx.coinTransaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount,
          balanceBefore,
          balanceAfter: newBalance,
          remark: `Deposited ${amount} coins`,
          referenceId: planId
        }
      });
    });
    
    return {
      amount,
      newBalance,
      balanceBefore
    };
  },

  async addBonus(userId, amount, remark = 'Bonus') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    
    const balanceBefore = user.balance;
    const newBalance = balanceBefore + amount;
    
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: { increment: amount }
        }
      });
      
      await tx.coinTransaction.create({
        data: {
          userId,
          type: 'BONUS',
          amount,
          balanceBefore,
          balanceAfter: newBalance,
          remark
        }
      });
    });
    
    return { amount, newBalance };
  },

  async transferBonusToMain(userId, amount) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.bonusBalance < amount) {
      throw new Error('Insufficient bonus balance');
    }
    
    const balanceBefore = user.balance;
    const bonusBefore = user.bonusBalance;
    const newBalance = balanceBefore + amount;
    const newBonus = bonusBefore - amount;
    
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: newBalance,
          bonusBalance: newBonus
        }
      });
      
      await tx.coinTransaction.create({
        data: {
          userId,
          type: 'BONUS',
          amount,
          balanceBefore,
          balanceAfter: newBalance,
          remark: `Transferred ${amount} bonus coins to main balance`
        }
      });
    });
    
    return {
      amount,
      newBalance,
      newBonusBalance: newBonus,
      balanceBefore
    };
  }
};
