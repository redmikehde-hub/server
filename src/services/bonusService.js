import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const bonusService = {
  async createBonusCode(data, createdBy = null) {
    const { code, coinAmount, discountPercent, description, maxUses, startsAt, expiresAt, minDeposit } = data;
    
    return prisma.bonusCode.create({
      data: {
        code: code.toUpperCase(),
        coinAmount,
        discountPercent: discountPercent || 0,
        description,
        maxUses: maxUses || null,
        minDeposit: minDeposit || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy
      }
    });
  },

  async updateBonusCode(id, data) {
    const { code, coinAmount, discountPercent, description, maxUses, startsAt, expiresAt, isActive, minDeposit } = data;
    
    return prisma.bonusCode.update({
      where: { id },
      data: {
        ...(code && { code: code.toUpperCase() }),
        ...(coinAmount !== undefined && { coinAmount }),
        ...(discountPercent !== undefined && { discountPercent }),
        ...(description && { description }),
        ...(maxUses !== undefined && { maxUses }),
        ...(minDeposit !== undefined && { minDeposit }),
        ...(startsAt !== undefined && { startsAt: startsAt ? new Date(startsAt) : null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(isActive !== undefined && { isActive })
      }
    });
  },

  async deleteBonusCode(id) {
    return prisma.bonusCode.delete({
      where: { id }
    });
  },

  async getAllBonusCodes() {
    return prisma.bonusCode.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },

  async getActiveBonusCodes() {
    const now = new Date();
    return prisma.bonusCode.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: now } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  async applyBonusCode(userId, code) {
    const bonusCode = await prisma.bonusCode.findUnique({
      where: { code: code.toUpperCase() }
    });
    
    if (!bonusCode) {
      throw new Error('Invalid bonus code');
    }
    
    if (!bonusCode.isActive) {
      throw new Error('This bonus code is no longer active');
    }
    
    const now = new Date();
    
    if (bonusCode.startsAt && now < bonusCode.startsAt) {
      throw new Error(`This bonus code starts on ${bonusCode.startsAt.toLocaleDateString()}`);
    }
    
    if (bonusCode.expiresAt && now > bonusCode.expiresAt) {
      throw new Error('This bonus code has expired');
    }
    
    if (bonusCode.maxUses && bonusCode.usedCount >= bonusCode.maxUses) {
      throw new Error('This bonus code has reached its usage limit');
    }
    
    const usedCode = await prisma.usedBonusCode.findUnique({
      where: {
        userId_bonusCodeId: {
          userId,
          bonusCodeId: bonusCode.id
        }
      }
    });
    
    if (usedCode) {
      throw new Error('You have already used this bonus code');
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    
    let coinsAwarded = bonusCode.coinAmount;
    
    if (bonusCode.discountPercent > 0 && bonusCode.minDeposit) {
      if (user.totalDeposited < bonusCode.minDeposit) {
        throw new Error(`Minimum deposit of ₹${bonusCode.minDeposit} required`);
      }
      coinsAwarded = Math.floor(coinsAwarded * (1 + bonusCode.discountPercent / 100));
    }
    
    const balanceBefore = user.balance;
    const newBalance = balanceBefore + coinsAwarded;
    
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: newBalance
        }
      });
      
      await tx.usedBonusCode.create({
        data: {
          userId,
          bonusCodeId: bonusCode.id,
          coinsAwarded
        }
      });
      
      await tx.bonusCode.update({
        where: { id: bonusCode.id },
        data: {
          usedCount: { increment: 1 }
        }
      });
      
      await tx.coinTransaction.create({
        data: {
          userId,
          type: 'PROMO',
          amount: coinsAwarded,
          balanceBefore,
          balanceAfter: newBalance,
          remark: `Bonus: ${bonusCode.code} - ${bonusCode.description}`
        }
      });
    });
    
    return {
      coinsAwarded,
      discountApplied: bonusCode.discountPercent > 0,
      bonusPercent: bonusCode.discountPercent,
      description: bonusCode.description,
      newBalance
    };
  },

  async createDefaultBonusCodes() {
    const existingCodes = await prisma.bonusCode.count();
    if (existingCodes > 0) return;
    
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    await prisma.bonusCode.createMany({
      data: [
        { 
          code: 'WELCOME50', 
          coinAmount: 50, 
          discountPercent: 0,
          description: 'Welcome bonus - Get 50 free coins!', 
          maxUses: 1,
          startsAt: now,
          expiresAt: nextMonth
        },
        { 
          code: 'PLAY100', 
          coinAmount: 100, 
          discountPercent: 0,
          description: 'Play and win - 100 free coins!', 
          startsAt: now,
          expiresAt: nextWeek
        },
        { 
          code: 'LUCKY200', 
          coinAmount: 200, 
          discountPercent: 0,
          description: 'Lucky draw - 200 free coins!', 
          startsAt: now,
          expiresAt: nextWeek
        },
        { 
          code: 'VIP500', 
          coinAmount: 500, 
          discountPercent: 0,
          description: 'VIP bonus - 500 free coins!',
          minDeposit: 1000,
          startsAt: now,
          expiresAt: nextMonth
        },
        { 
          code: 'FESTIVE1000', 
          coinAmount: 1000, 
          discountPercent: 0,
          description: 'Festival special - 1000 free coins!',
          minDeposit: 5000,
          startsAt: now,
          expiresAt: nextMonth
        }
      ]
    });
  }
};
