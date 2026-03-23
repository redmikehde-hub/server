import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROUND_DURATION = 30;
const BETTING_DURATION = 25;

async function settleMatkaRound(game) {
  const result = String(Math.floor(Math.random() * 100)).padStart(2, '0');
  const lastDigit = result.slice(-1);
  const updatedBets = [];

  for (const bet of game.bets) {
    let isWin = false;
    let reward = 0;

    if (bet.betType === 'DIGIT' && bet.selectedNumber === lastDigit) {
      isWin = true;
      reward = bet.betAmount * 2;
    }

    if (bet.betType === 'NUMBER' && bet.selectedNumber === result) {
      isWin = true;
      reward = bet.betAmount * 5;
    }

    if (isWin) {
      const user = await prisma.user.findUnique({ where: { id: bet.userId } });
      if (user) {
        await prisma.user.update({
          where: { id: bet.userId },
          data: {
            balance: user.balance + reward,
            totalWinnings: user.totalWinnings + reward,
            gamesWon: user.gamesWon + 1,
          }
        });

        await prisma.coinTransaction.create({
          data: {
            userId: bet.userId,
            type: 'GAME_WIN',
            amount: reward,
            balanceBefore: user.balance,
            balanceAfter: user.balance + reward,
            remark: `Matka win: ${result} (bet: ${bet.selectedNumber})`,
          }
        });
      }
    }

    await prisma.gameHistory.create({
      data: {
        userId: bet.userId,
        gameName: 'Matka',
        betAmount: bet.betAmount,
        result: isWin ? 'WIN' : 'LOSS',
        winAmount: isWin ? reward : 0,
        multiplier: isWin ? (bet.betType === 'NUMBER' ? 5 : 2) : 0,
        selection: bet.selectedNumber,
      }
    });

    await prisma.matkaBet.update({
      where: { id: bet.id },
      data: { result, isWin, reward }
    });

    updatedBets.push({ betId: bet.id, isWin, reward, userId: bet.userId });
  }

  await prisma.matkaGame.update({
    where: { id: game.id },
    data: {
      result,
      status: 'COMPLETED',
      endTime: new Date(),
    }
  });

  return { result, updatedBets };
}

async function ensureCurrentRound() {
  let game = await prisma.matkaGame.findFirst({
    where: { status: { in: ['WAITING', 'BETTING'] } },
    orderBy: { createdAt: 'desc' },
    include: { bets: true },
  });

  if (!game) {
    return prisma.matkaGame.create({
      data: { roundNumber: 1, status: 'WAITING' },
      include: { bets: true },
    });
  }

  const elapsed = Math.floor((Date.now() - new Date(game.startTime).getTime()) / 1000);
  if (elapsed < ROUND_DURATION) {
    return game;
  }

  await settleMatkaRound(game);

  return prisma.matkaGame.create({
    data: {
      roundNumber: game.roundNumber + 1,
      status: 'WAITING',
    },
    include: { bets: true },
  });
}

export async function getCurrentRound(req, res) {
  try {
    const game = await ensureCurrentRound();

    const elapsed = Math.floor((Date.now() - new Date(game.startTime).getTime()) / 1000);
    const remaining = Math.max(0, ROUND_DURATION - elapsed);
    const bettingOpen = elapsed < BETTING_DURATION;

    res.json({
      success: true,
      round: {
        id: game.id,
        number: game.roundNumber,
        result: game.result,
        status: game.status,
        remainingTime: remaining,
        bettingOpen,
        totalBets: game.bets.length,
        totalAmount: game.bets.reduce((sum, b) => sum + b.betAmount, 0),
      }
    });
  } catch (error) {
    console.error('Get current round error:', error);
    res.status(500).json({ error: 'Failed to get round' });
  }
}

export async function placeBet(req, res) {
  try {
    const userId = req.user.id;
    const { selectedNumber, betAmount, betType } = req.body;

    if (!selectedNumber || !betAmount || !betType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (betAmount < 10) {
      return res.status(400).json({ error: 'Minimum bet is 10 coins' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const game = await ensureCurrentRound();

    const elapsed = Math.floor((Date.now() - new Date(game.startTime).getTime()) / 1000);
    if (elapsed >= BETTING_DURATION) {
      return res.status(400).json({ error: 'Betting closed for this round' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { balance: user.balance - betAmount }
    });

    await prisma.coinTransaction.create({
      data: {
        userId,
        type: 'GAME_LOSS',
        amount: -betAmount,
        balanceBefore: user.balance,
        balanceAfter: user.balance - betAmount,
        remark: `Matka bet: ${selectedNumber} (${betType})`,
      }
    });

    const bet = await prisma.matkaBet.create({
      data: {
        userId,
        gameId: game.id,
        betAmount,
        selectedNumber: String(selectedNumber),
        betType,
      }
    });

    if (game.status === 'WAITING') {
      await prisma.matkaGame.update({
        where: { id: game.id },
        data: { status: 'BETTING' }
      });
    }

    res.json({
      success: true,
      bet: {
        id: bet.id,
        selectedNumber,
        betAmount,
        betType,
      },
      remainingBalance: user.balance - betAmount,
    });
  } catch (error) {
    console.error('Place bet error:', error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
}

export async function getResults(req, res) {
  try {
    const { limit = 10 } = req.query;

    const results = await prisma.matkaGame.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      include: {
        bets: {
          where: { userId: req.user.id },
        }
      }
    });

    const formattedResults = results.map(r => ({
      roundNumber: r.roundNumber,
      result: r.result,
      createdAt: r.createdAt,
      myBets: r.bets.map(b => ({
        selectedNumber: b.selectedNumber,
        betAmount: b.betAmount,
        isWin: b.isWin,
        reward: b.reward,
      })),
      myTotalWin: r.bets.reduce((sum, b) => sum + (b.isWin ? b.reward : 0), 0),
    }));

    res.json({
      success: true,
      results: formattedResults,
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
}

export async function getMyBets(req, res) {
  try {
    const { limit = 20 } = req.query;

    const bets = await prisma.matkaBet.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      include: {
        game: true,
      }
    });

    res.json({
      success: true,
      bets: bets.map(b => ({
        id: b.id,
        gameId: b.gameId,
        roundNumber: b.game.roundNumber,
        selectedNumber: b.selectedNumber,
        betAmount: b.betAmount,
        betType: b.betType,
        result: b.result,
        isWin: b.isWin,
        reward: b.reward,
        createdAt: b.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get my bets error:', error);
    res.status(500).json({ error: 'Failed to get bets' });
  }
}

export async function resolveRound(req, res) {
  try {
    const { gameId } = req.body;

    const game = await prisma.matkaGame.findUnique({
      where: { id: gameId },
      include: { bets: true }
    });

    if (!game || game.status !== 'BETTING') {
      return res.status(400).json({ error: 'Game not found or already resolved' });
    }

    const { result, updatedBets } = await settleMatkaRound(game);

    const nextRoundNumber = game.roundNumber + 1;
    const newGame = await prisma.matkaGame.create({
      data: {
        roundNumber: nextRoundNumber,
        status: 'WAITING',
      }
    });

    const winningBets = updatedBets.filter(b => b.isWin);
    const totalPayout = winningBets.reduce((sum, b) => sum + b.reward, 0);

    res.json({
      success: true,
      result,
      winningBets: winningBets.length,
      totalPayout,
      nextRoundId: newGame.id,
    });
  } catch (error) {
    console.error('Resolve round error:', error);
    res.status(500).json({ error: 'Failed to resolve round' });
  }
}

export async function adminResolveRound(req, res) {
  try {
    const { gameId } = req.body;

    const game = await prisma.matkaGame.findUnique({
      where: { id: gameId },
      include: { bets: true }
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    return resolveRound(req, res);
  } catch (error) {
    console.error('Admin resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve round' });
  }
}

export async function getStats(req, res) {
  try {
    const totalBets = await prisma.matkaBet.count();
    const totalWinnings = await prisma.matkaBet.aggregate({
      where: { isWin: true },
      _sum: { reward: true }
    });
    const completedRounds = await prisma.matkaGame.count({
      where: { status: 'COMPLETED' }
    });
    const currentRound = await prisma.matkaGame.findFirst({
      where: { status: { in: ['WAITING', 'BETTING'] } },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      stats: {
        totalBets,
        totalWinnings: totalWinnings._sum.reward || 0,
        completedRounds,
        currentRound: currentRound ? {
          id: currentRound.id,
          number: currentRound.roundNumber,
          status: currentRound.status,
        } : null,
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}
