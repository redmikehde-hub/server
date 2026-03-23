import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const WAITING_MS = 5000;
const CRASH_HOLD_MS = 3500;
const TICK_MS = 100;
const HISTORY_LIMIT = 12;

let ioInstance = null;
let loopStarted = false;
let roundTimer = null;
let tickTimer = null;
let publicGameId = null;

const state = {
  phase: 'waiting',
  roundId: `aviator_${Date.now()}`,
  countdownMs: WAITING_MS,
  elapsedMs: 0,
  multiplier: 1,
  crashMultiplier: null,
  crashedAt: null,
  startedAt: null,
  bettingClosesAt: Date.now() + WAITING_MS,
  history: [],
  liveBets: [],
  activeBets: new Map(),
};

function emitState() {
  if (!ioInstance) return;
  ioInstance.to('aviator').emit('aviator:state', getPublicState());
}

function randomCrashMultiplier() {
  const roll = Math.random();
  if (roll < 0.35) return Number((1 + Math.random() * 1.4).toFixed(2));
  if (roll < 0.7) return Number((2.4 + Math.random() * 3.6).toFixed(2));
  if (roll < 0.92) return Number((6 + Math.random() * 12).toFixed(2));
  return Number((18 + Math.random() * 35).toFixed(2));
}

function multiplierAt(ms) {
  const seconds = ms / 1000;
  return Number((1 + (Math.pow(1.085, seconds * 10) - 1) / 12).toFixed(2));
}

async function ensureAviatorGame() {
  if (publicGameId) return publicGameId;
  const existing = await prisma.game.findFirst({ where: { name: 'Aviator' } });
  if (existing) {
    publicGameId = existing.id;
    return existing.id;
  }
  const created = await prisma.game.create({
    data: {
      name: 'Aviator',
      description: 'Cash out before the rocket crashes',
      category: 'Slots',
      minBet: 10,
      maxBet: 5000,
      maxWin: 200000,
      color: '#22c55e',
      icon: 'Rocket',
      isHot: true,
      isFeatured: true,
      players: 125000,
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=400&fit=crop',
    },
  });
  publicGameId = created.id;
  return created.id;
}

function getLiveBetsList() {
  return Array.from(state.activeBets.values())
    .filter((bet) => bet.status === 'ACTIVE' || bet.status === 'CASHED_OUT')
    .map((bet) => ({
      userId: bet.userId,
      name: bet.name,
      betAmount: bet.betAmount,
      autoCashoutAt: bet.autoCashoutAt,
      status: bet.status,
      cashoutMultiplier: bet.cashoutMultiplier,
      reward: bet.reward || 0,
    }));
}

function getPublicState() {
  return {
    phase: state.phase,
    roundId: state.roundId,
    countdownMs: state.phase === 'waiting' ? Math.max(0, state.bettingClosesAt - Date.now()) : 0,
    multiplier: state.multiplier,
    crashMultiplier: state.crashMultiplier,
    crashedAt: state.crashedAt,
    history: state.history,
    liveBets: getLiveBetsList(),
    playersCount: getLiveBetsList().filter((bet) => bet.status === 'ACTIVE').length,
  };
}

async function settleLoss(bet) {
  const gameId = await ensureAviatorGame();
  await prisma.$transaction(async (tx) => {
    await tx.gameBet.update({
      where: { id: bet.dbBetId },
      data: {
        status: 'LOSS',
        odds: state.crashMultiplier,
        selection: JSON.stringify({
          roundId: bet.roundId,
          crashMultiplier: state.crashMultiplier,
          autoCashoutAt: bet.autoCashoutAt,
        }),
      },
    });
    await tx.gameHistory.create({
      data: {
        userId: bet.userId,
        gameName: 'Aviator',
        gameId,
        betAmount: bet.betAmount,
        result: 'LOSS',
        winAmount: 0,
        multiplier: state.crashMultiplier || 1,
        selection: JSON.stringify({
          cashoutMultiplier: null,
          crashMultiplier: state.crashMultiplier,
          autoCashoutAt: bet.autoCashoutAt,
        }),
      },
    });
  });
}

async function settleCashout(bet, cashoutMultiplier) {
  const user = await prisma.user.findUnique({ where: { id: bet.userId } });
  if (!user) throw new Error('User not found');
  const reward = Number((bet.betAmount * cashoutMultiplier).toFixed(2));
  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + reward;
  const gameId = await ensureAviatorGame();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: bet.userId },
      data: {
        balance: balanceAfter,
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
        balanceBefore,
        balanceAfter,
        remark: `Aviator cashout at ${cashoutMultiplier.toFixed(2)}x`,
        referenceId: bet.dbBetId,
      },
    });
    await tx.gameBet.update({
      where: { id: bet.dbBetId },
      data: {
        status: 'WIN',
        odds: cashoutMultiplier,
        winAmount: reward,
        selection: JSON.stringify({
          roundId: bet.roundId,
          cashoutMultiplier,
          crashMultiplier: state.crashMultiplier,
          autoCashoutAt: bet.autoCashoutAt,
        }),
      },
    });
    await tx.gameHistory.create({
      data: {
        userId: bet.userId,
        gameName: 'Aviator',
        gameId,
        betAmount: bet.betAmount,
        result: 'WIN',
        winAmount: reward,
        multiplier: cashoutMultiplier,
        selection: JSON.stringify({
          cashoutMultiplier,
          crashMultiplier: state.crashMultiplier,
          autoCashoutAt: bet.autoCashoutAt,
        }),
      },
    });
  });

  return { reward, cashoutMultiplier, balanceAfter };
}

async function crashRound() {
  clearInterval(tickTimer);
  tickTimer = null;
  state.phase = 'crashed';
  state.multiplier = state.crashMultiplier;
  state.crashedAt = state.crashMultiplier;

  const openLosses = Array.from(state.activeBets.values()).filter((bet) => bet.status === 'ACTIVE');
  for (const bet of openLosses) {
    bet.status = 'LOSS';
    await settleLoss(bet);
  }

  state.history = [state.crashMultiplier, ...state.history].slice(0, HISTORY_LIMIT);
  emitState();
  ioInstance?.to('aviator').emit('aviator:crash', { crashMultiplier: state.crashMultiplier, roundId: state.roundId });

  roundTimer = setTimeout(() => {
    startWaitingRound();
  }, CRASH_HOLD_MS);
}

async function maybeAutoCashout() {
  const active = Array.from(state.activeBets.values()).filter((bet) => bet.status === 'ACTIVE' && bet.autoCashoutAt && state.multiplier >= bet.autoCashoutAt);
  for (const bet of active) {
    bet.status = 'CASHED_OUT';
    bet.cashoutMultiplier = state.multiplier;
    const settled = await settleCashout(bet, state.multiplier);
    bet.reward = settled.reward;
    ioInstance?.to(`user_${bet.userId}`).emit('aviator:cashed_out', {
      roundId: bet.roundId,
      reward: settled.reward,
      cashoutMultiplier: state.multiplier,
      betAmount: bet.betAmount,
      auto: true,
    });
  }
}

function startRunningRound() {
  state.phase = 'running';
  state.startedAt = Date.now();
  state.elapsedMs = 0;
  state.multiplier = 1;
  state.crashMultiplier = randomCrashMultiplier();
  state.crashedAt = null;
  emitState();
  ioInstance?.to('aviator').emit('aviator:round_started', { roundId: state.roundId });

  tickTimer = setInterval(async () => {
    state.elapsedMs = Date.now() - state.startedAt;
    state.multiplier = multiplierAt(state.elapsedMs);
    await maybeAutoCashout();
    emitState();
    if (state.multiplier >= state.crashMultiplier) {
      await crashRound();
    }
  }, TICK_MS);
}

function startWaitingRound() {
  clearTimeout(roundTimer);
  clearInterval(tickTimer);
  state.phase = 'waiting';
  state.roundId = `aviator_${Date.now()}`;
  state.bettingClosesAt = Date.now() + WAITING_MS;
  state.multiplier = 1;
  state.crashMultiplier = null;
  state.crashedAt = null;
  state.activeBets = new Map();
  emitState();
  ioInstance?.to('aviator').emit('aviator:waiting', { roundId: state.roundId, countdownMs: WAITING_MS });
  roundTimer = setTimeout(() => {
    startRunningRound();
  }, WAITING_MS);
}

export function initializeAviator(io) {
  ioInstance = io;
  if (!loopStarted) {
    loopStarted = true;
    startWaitingRound();
  }
}

export async function placeAviatorBet({ userId, name, betAmount, autoCashoutAt = null }) {
  if (state.phase !== 'waiting') throw new Error('Betting is closed for this round');
  if (betAmount < 10) throw new Error('Minimum bet is 10 coins');

  const existing = Array.from(state.activeBets.values()).find((bet) => bet.userId === userId && bet.roundId === state.roundId);
  if (existing) throw new Error('You already placed a bet in this round');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.balance < betAmount) throw new Error('Insufficient balance');

  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore - betAmount;
  const gameId = await ensureAviatorGame();

  const dbBet = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: balanceAfter,
      },
    });
    await tx.coinTransaction.create({
      data: {
        userId,
        type: 'GAME_LOSS',
        amount: -betAmount,
        balanceBefore,
        balanceAfter,
        remark: `Aviator bet placed for round ${state.roundId}`,
      },
    });
    return tx.gameBet.create({
      data: {
        userId,
        gameId,
        roundId: state.roundId,
        amount: betAmount,
        selection: JSON.stringify({ autoCashoutAt }),
        status: 'PENDING',
      },
    });
  });

  const bet = {
    id: `${userId}_${state.roundId}`,
    dbBetId: dbBet.id,
    userId,
    name,
    roundId: state.roundId,
    betAmount,
    autoCashoutAt,
    status: 'ACTIVE',
    reward: 0,
    cashoutMultiplier: null,
  };
  state.activeBets.set(bet.id, bet);
  emitState();
  return { roundId: state.roundId, balanceAfter, bet };
}

export async function cashOutAviator({ userId }) {
  if (state.phase !== 'running') throw new Error('Round is not running');
  const bet = Array.from(state.activeBets.values()).find((item) => item.userId === userId && item.roundId === state.roundId);
  if (!bet) throw new Error('No active bet found');
  if (bet.status !== 'ACTIVE') throw new Error('Bet already settled');

  bet.status = 'CASHED_OUT';
  bet.cashoutMultiplier = state.multiplier;
  const settled = await settleCashout(bet, state.multiplier);
  bet.reward = settled.reward;
  emitState();
  return { ...settled, roundId: state.roundId };
}

export async function getAviatorHistory(userId, limit = 20) {
  const items = await prisma.gameHistory.findMany({
    where: { userId, gameName: 'Aviator' },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return items;
}

export function getAviatorStateForUser(userId) {
  const activeBet = Array.from(state.activeBets.values()).find((bet) => bet.userId === userId && bet.roundId === state.roundId);
  return {
    ...getPublicState(),
    myBet: activeBet
      ? {
          betAmount: activeBet.betAmount,
          autoCashoutAt: activeBet.autoCashoutAt,
          status: activeBet.status,
          reward: activeBet.reward,
          cashoutMultiplier: activeBet.cashoutMultiplier,
        }
      : null,
  };
}
