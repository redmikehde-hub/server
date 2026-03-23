import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MATCH_INTERVAL_MS = 12 * 60 * 1000;
const MATCH_DURATION_MS = 9 * 60 * 1000;

const baseMatches = [
  {
    id: 'sport-1',
    league: 'Premier Clash',
    sport: 'Football',
    teamA: 'Mumbai Strikers',
    teamB: 'Delhi Royals',
    predictionOdds: { TEAM_A: 1.95, DRAW: 3.4, TEAM_B: 2.1 },
    tags: ['HOT', 'PREMIUM'],
    banner: 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=1200&h=800&fit=crop',
  },
  {
    id: 'sport-2',
    league: 'Cricket Power Cup',
    sport: 'Cricket',
    teamA: 'Chennai Blazers',
    teamB: 'Bengal Tigers',
    predictionOdds: { TEAM_A: 1.82, DRAW: 4.2, TEAM_B: 2.28 },
    tags: ['POPULAR'],
    banner: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1200&h=800&fit=crop',
  },
  {
    id: 'sport-3',
    league: 'Night Derby',
    sport: 'Football',
    teamA: 'Goa Waves',
    teamB: 'Pune Falcons',
    predictionOdds: { TEAM_A: 2.18, DRAW: 3.18, TEAM_B: 1.88 },
    tags: ['LIVE'],
    banner: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=1200&h=800&fit=crop',
  },
  {
    id: 'sport-4',
    league: 'T20 Thunder',
    sport: 'Cricket',
    teamA: 'Hyderabad Storm',
    teamB: 'Punjab Smash',
    predictionOdds: { TEAM_A: 1.74, DRAW: 4.8, TEAM_B: 2.45 },
    tags: ['HOT'],
    banner: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200&h=800&fit=crop',
  },
  {
    id: 'sport-5',
    league: 'Elite Showdown',
    sport: 'Football',
    teamA: 'Kerala Titans',
    teamB: 'Kolkata Force',
    predictionOdds: { TEAM_A: 2.02, DRAW: 3.1, TEAM_B: 2.04 },
    tags: ['PREMIUM'],
    banner: 'https://images.unsplash.com/photo-1508098682722-e99c643e7485?w=1200&h=800&fit=crop',
  },
];

function getCycleStart() {
  const now = Date.now();
  return now - (now % MATCH_INTERVAL_MS);
}

function determineResult(matchId) {
  const sum = matchId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const outcomes = ['TEAM_A', 'TEAM_B', 'DRAW'];
  return outcomes[sum % outcomes.length];
}

function buildMatches() {
  const cycleStart = getCycleStart();
  return baseMatches.map((match, index) => {
    const startTime = new Date(cycleStart + index * 90 * 1000);
    const endTime = new Date(startTime.getTime() + MATCH_DURATION_MS);
    const now = Date.now();
    const result = determineResult(match.id);
    const status = now < startTime.getTime() ? 'SCHEDULED' : now < endTime.getTime() ? 'LIVE' : 'COMPLETED';

    return {
      ...match,
      startTime,
      endTime,
      result: status === 'COMPLETED' ? result : null,
      status,
      playersCount: 120 + index * 31,
    };
  });
}

async function ensureSportGame() {
  const game = await prisma.game.findFirst({ where: { name: 'Sport' } });
  if (!game) {
    throw new Error('Sport game is not available');
  }
  return game;
}

function getMatchById(matchId) {
  return buildMatches().find((match) => match.id === matchId);
}

async function settlePendingBets(userId = null) {
  const sportGame = await ensureSportGame();
  const where = {
    gameId: sportGame.id,
    status: 'PENDING',
  };
  if (userId) where.userId = userId;

  const pendingBets = await prisma.gameBet.findMany({ where, orderBy: { createdAt: 'asc' } });
  for (const bet of pendingBets) {
    const meta = bet.selection ? JSON.parse(bet.selection) : {};
    const match = getMatchById(meta.matchId);
    if (!match || match.status !== 'COMPLETED') continue;

    const isWin = meta.prediction === match.result;
    const reward = isWin ? Number((bet.amount * (bet.odds || 1)).toFixed(2)) : 0;
    const user = await prisma.user.findUnique({ where: { id: bet.userId } });
    if (!user) continue;

    await prisma.$transaction(async (tx) => {
      await tx.gameBet.update({
        where: { id: bet.id },
        data: {
          status: isWin ? 'WIN' : 'LOSS',
          winAmount: reward,
          selection: JSON.stringify({ ...meta, result: match.result }),
        },
      });

      if (isWin) {
        await tx.user.update({
          where: { id: bet.userId },
          data: {
            balance: user.balance + reward,
            gamesPlayed: { increment: 1 },
            gamesWon: { increment: 1 },
            totalWinnings: { increment: reward },
          },
        });
        await tx.coinTransaction.create({
          data: {
            userId: bet.userId,
            type: 'GAME_WIN',
            amount: reward,
            balanceBefore: user.balance,
            balanceAfter: user.balance + reward,
            remark: `Sport prediction win on ${match.teamA} vs ${match.teamB}`,
            referenceId: bet.id,
          },
        });
      } else {
        await tx.user.update({
          where: { id: bet.userId },
          data: { gamesPlayed: { increment: 1 } },
        });
      }

      await tx.gameHistory.create({
        data: {
          userId: bet.userId,
          gameName: 'Sport',
          gameId: sportGame.id,
          betAmount: bet.amount,
          result: isWin ? 'WIN' : 'LOSS',
          winAmount: reward,
          multiplier: bet.odds || 1,
          selection: JSON.stringify({
            ...meta,
            result: match.result,
            teams: `${match.teamA} vs ${match.teamB}`,
          }),
        },
      });
    });
  }
}

export async function getSportMatches(userId) {
  await settlePendingBets(userId);
  const sportGame = await ensureSportGame();
  const myPending = await prisma.gameBet.findMany({
    where: { userId, gameId: sportGame.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const byMatch = new Map();
  myPending.forEach((bet) => {
    const meta = bet.selection ? JSON.parse(bet.selection) : {};
    if (!byMatch.has(meta.matchId)) {
      byMatch.set(meta.matchId, { ...bet, meta });
    }
  });

  return buildMatches().map((match) => ({
    ...match,
    myBet: byMatch.has(match.id)
      ? {
          id: byMatch.get(match.id).id,
          prediction: byMatch.get(match.id).meta.prediction,
          betAmount: byMatch.get(match.id).amount,
          odds: byMatch.get(match.id).odds,
          status: byMatch.get(match.id).status,
          winAmount: byMatch.get(match.id).winAmount,
        }
      : null,
  }));
}

export async function placeSportBet(userId, { matchId, prediction, betAmount }) {
  await settlePendingBets(userId);
  const sportGame = await ensureSportGame();
  const match = getMatchById(matchId);
  if (!match) throw new Error('Match not found');
  if (match.status !== 'SCHEDULED') throw new Error('Betting is closed for this match');
  if (!['TEAM_A', 'TEAM_B', 'DRAW'].includes(prediction)) throw new Error('Invalid prediction');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.balance < betAmount) throw new Error('Insufficient balance');

  const existing = await prisma.gameBet.findFirst({
    where: {
      userId,
      gameId: sportGame.id,
      status: 'PENDING',
      selection: { contains: `"matchId":"${matchId}"` },
    },
  });
  if (existing) throw new Error('You already placed a prediction for this match');

  const odds = match.predictionOdds[prediction];
  const balanceBefore = user.balance;
  const balanceAfter = user.balance - betAmount;

  const bet = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { balance: balanceAfter },
    });
    await tx.coinTransaction.create({
      data: {
        userId,
        type: 'GAME_LOSS',
        amount: -betAmount,
        balanceBefore,
        balanceAfter,
        remark: `Sport prediction bet on ${match.teamA} vs ${match.teamB}`,
      },
    });
    return tx.gameBet.create({
      data: {
        userId,
        gameId: sportGame.id,
        roundId: matchId,
        amount: betAmount,
        odds,
        status: 'PENDING',
        selection: JSON.stringify({
          matchId,
          prediction,
          teamA: match.teamA,
          teamB: match.teamB,
          startTime: match.startTime,
        }),
      },
    });
  });

  return {
    betId: bet.id,
    balanceAfter,
    matchId,
    odds,
    prediction,
  };
}

export async function getSportBetHistory(userId, limit = 20) {
  await settlePendingBets(userId);
  const sportGame = await ensureSportGame();
  const bets = await prisma.gameBet.findMany({
    where: { userId, gameId: sportGame.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return bets.map((bet) => {
    const meta = bet.selection ? JSON.parse(bet.selection) : {};
    return {
      id: bet.id,
      matchId: meta.matchId,
      teams: `${meta.teamA} vs ${meta.teamB}`,
      prediction: meta.prediction,
      actualResult: meta.result || null,
      betAmount: bet.amount,
      odds: bet.odds,
      status: bet.status,
      reward: bet.winAmount || 0,
      createdAt: bet.createdAt,
    };
  });
}
