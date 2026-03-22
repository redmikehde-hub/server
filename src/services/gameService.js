import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const gameService = {
  async playGame(userId, gameData) {
    const { gameName, gameId, betAmount, selection, multiplier = 2 } = gameData;
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    
    if (user.balance < betAmount) {
      throw new Error('Insufficient balance');
    }
    
    if (betAmount < 1) {
      throw new Error('Minimum bet is 1 coin');
    }
    
    const balanceBefore = user.balance;
    
    const winChance = 0.45 + (multiplier > 3 ? -0.1 : 0);
    const isWin = Math.random() < winChance;
    
    let result, winAmount, newBalance;
    
    await prisma.$transaction(async (tx) => {
      if (isWin) {
        winAmount = betAmount * multiplier;
        result = 'WIN';
        newBalance = balanceBefore + winAmount;
        
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: newBalance,
            gamesPlayed: { increment: 1 },
            gamesWon: { increment: 1 },
            totalWinnings: { increment: winAmount }
          }
        });
        
        await tx.coinTransaction.create({
          data: {
            userId,
            type: 'GAME_WIN',
            amount: winAmount,
            balanceBefore,
            balanceAfter: newBalance,
            remark: `Won ${winAmount} coins in ${gameName}`
          }
        });
      } else {
        winAmount = 0;
        result = 'LOSS';
        newBalance = balanceBefore - betAmount;
        
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: newBalance,
            gamesPlayed: { increment: 1 }
          }
        });
        
        await tx.coinTransaction.create({
          data: {
            userId,
            type: 'GAME_LOSS',
            amount: betAmount,
            balanceBefore,
            balanceAfter: newBalance,
            remark: `Lost ${betAmount} coins in ${gameName}`
          }
        });
      }
      
      await tx.gameHistory.create({
        data: {
          userId,
          gameName,
          gameId,
          betAmount,
          result,
          winAmount,
          multiplier,
          selection
        }
      });
    });
    
    return {
      result,
      winAmount,
      newBalance,
      gameName
    };
  },

  async getGameHistory(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const [history, total] = await Promise.all([
      prisma.gameHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.gameHistory.count({ where: { userId } })
    ]);
    
    return {
      history,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async getUserStats(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        gamesPlayed: true,
        gamesWon: true,
        totalWinnings: true,
        balance: true
      }
    });
    
    const totalGames = user?.gamesPlayed || 0;
    const gamesWon = user?.gamesWon || 0;
    const winRate = totalGames > 0 ? ((gamesWon / totalGames) * 100).toFixed(1) : 0;
    
    const recentGames = await prisma.gameHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    
    return {
      totalGames,
      gamesWon,
      winRate,
      totalWinnings: user?.totalWinnings || 0,
      currentBalance: user?.balance || 0,
      recentGames
    };
  }
};
