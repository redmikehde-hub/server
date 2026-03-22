import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const depositService = {
  async getPlans() {
    return prisma.depositPlan.findMany({
      where: { isActive: true },
      orderBy: [
        { isPopular: 'desc' },
        { rupees: 'asc' }
      ]
    });
  },

  async createDefaultPlans() {
    const existingPlans = await prisma.depositPlan.count();
    if (existingPlans > 0) return;
    
    await prisma.depositPlan.createMany({
      data: [
        { name: 'Starter', rupees: 100, coins: 100, bonus: 0, isPopular: false },
        { name: 'Basic', rupees: 500, coins: 500, bonus: 25, isPopular: false },
        { name: 'Premium', rupees: 1000, coins: 1000, bonus: 100, isPopular: true },
        { name: 'Gold', rupees: 2500, coins: 2500, bonus: 350, isPopular: false },
        { name: 'Platinum', rupees: 5000, coins: 5000, bonus: 1000, isPopular: false },
        { name: 'Diamond', rupees: 10000, coins: 10000, bonus: 2500, isPopular: false }
      ]
    });
  },

  async purchasePlan(userId, planId) {
    const plan = await prisma.depositPlan.findUnique({
      where: { id: planId }
    });
    
    if (!plan || !plan.isActive) {
      throw new Error('Invalid or inactive plan');
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    
    const balanceBefore = user.balance;
    const totalCoins = plan.coins + plan.bonus;
    const newBalance = balanceBefore + totalCoins;
    
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          balance: newBalance,
          totalDeposited: { increment: plan.rupees }
        }
      });
      
      await tx.coinTransaction.create({
        data: {
          userId,
          type: 'DEPOSIT',
          amount: totalCoins,
          balanceBefore,
          balanceAfter: newBalance,
          remark: `Purchased ${plan.name} plan - ${plan.coins} coins + ${plan.bonus} bonus`,
          referenceId: planId
        }
      });
    });
    
    return {
      planName: plan.name,
      coins: plan.coins,
      bonus: plan.bonus,
      totalCoins,
      newBalance
    };
  }
};
