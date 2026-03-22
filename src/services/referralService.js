import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REFERRAL_BONUS = 10;
const REFERRED_BONUS = 10;

export const referralService = {
  async getReferralCode(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true, name: true }
    });
    
    if (!user) {
      throw new Error('User not found');
    }
    
    const referralCount = await prisma.referralReward.count({
      where: { referrerId: userId }
    });
    
    const totalEarnings = await prisma.referralReward.aggregate({
      where: { referrerId: userId },
      _sum: { amount: true }
    });
    
    return {
      referralCode: user.referralCode,
      referralCount,
      totalEarnings: totalEarnings._sum.amount || 0,
      referralBonus: REFERRAL_BONUS,
      referredBonus: REFERRED_BONUS
    };
  },

  async applyReferralBonus(referrerId, referredId) {
    const existingReward = await prisma.referralReward.findFirst({
      where: { referrerId, referredId }
    });
    
    if (existingReward) {
      return { message: 'Referral bonus already awarded' };
    }
    
    const [referrer, referred] = await Promise.all([
      prisma.user.findUnique({ where: { id: referrerId } }),
      prisma.user.findUnique({ where: { id: referredId } })
    ]);
    
    if (!referrer || !referred) {
      throw new Error('User not found');
    }
    
    const referrerBalanceBefore = referrer.balance;
    const referredBalanceBefore = referred.balance;
    
    const referrerNewBalance = referrerBalanceBefore + REFERRAL_BONUS;
    const referredNewBalance = referredBalanceBefore + REFERRED_BONUS;
    
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: referrerId },
        data: { balance: referrerNewBalance }
      });
      
      await tx.user.update({
        where: { id: referredId },
        data: { balance: referredNewBalance }
      });
      
      await tx.referralReward.create({
        data: {
          referrerId,
          referredId,
          type: 'REFERRAL_BONUS',
          amount: REFERRAL_BONUS
        }
      });
      
      await tx.referralReward.create({
        data: {
          referrerId: referredId,
          referredId: referrerId,
          type: 'WELCOME_BONUS',
          amount: REFERRED_BONUS
        }
      });
      
      await tx.coinTransaction.create({
        data: {
          userId: referrerId,
          type: 'REFERRAL_BONUS',
          amount: REFERRAL_BONUS,
          balanceBefore: referrerBalanceBefore,
          balanceAfter: referrerNewBalance,
          remark: `Referral bonus for inviting ${referred.name}`
        }
      });
      
      await tx.coinTransaction.create({
        data: {
          userId: referredId,
          type: 'REFERRAL_BONUS',
          amount: REFERRED_BONUS,
          balanceBefore: referredBalanceBefore,
          balanceAfter: referredNewBalance,
          remark: `Welcome bonus using referral code`
        }
      });
    });
    
    return {
      referrerBonus: REFERRAL_BONUS,
      referredBonus: REFERRED_BONUS,
      referrerNewBalance,
      referredNewBalance
    };
  },

  async getReferralHistory(userId) {
    const rewards = await prisma.referralReward.findMany({
      where: {
        OR: [{ referrerId: userId }, { referredId: userId }]
      },
      include: {
        referrer: { select: { name: true } },
        referred: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return rewards.map(r => ({
      id: r.id,
      type: r.type,
      amount: r.amount,
      isReferrer: r.referrerId === userId,
      otherUser: r.referrerId === userId ? r.referred?.name : r.referrer?.name,
      createdAt: r.createdAt
    }));
  },

  async getReferrals(userId) {
    const referrals = await prisma.user.findMany({
      where: { referredBy: userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        gamesPlayed: true,
        totalWinnings: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return referrals;
  }
};
