import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SPORTS_DB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';
const CACHE_MS = 60 * 1000;
const LEAGUES = [
  { id: '4460', sport: 'Cricket', label: 'Indian Premier League', season: '2026' },
  { id: '4463', sport: 'Cricket', label: 'English T20 Blast', season: '2026' },
  { id: '5529', sport: 'Cricket', label: 'Bangladesh Premier League', season: '2025-2026' },
  { id: '5176', sport: 'Cricket', label: 'Caribbean Premier League', season: '2026' },
];

let cache = {
  expiresAt: 0,
  matches: [],
  byId: new Map(),
};

function normalizeStatus(status, startTime, endTime) {
  const value = (status || '').toLowerCase();
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : start + 2 * 60 * 60 * 1000;

  if (value.includes('not started')) return 'SCHEDULED';
  if (value.includes('match finished') || value.includes('ft') || value.includes('after pen') || value.includes('ended')) return 'COMPLETED';
  if (now < start) return 'SCHEDULED';
  if (now >= start && now <= end) return 'LIVE';
  return 'COMPLETED';
}

function deriveResult(event) {
  const home = Number(event.intHomeScore);
  const away = Number(event.intAwayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  if (home > away) return 'TEAM_A';
  if (away > home) return 'TEAM_B';
  return 'DRAW';
}

function deriveOdds(event) {
  const seed = String(event.idEvent || '')
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const swing = (seed % 13) / 100;
  return {
    TEAM_A: Number((1.72 + swing).toFixed(2)),
    DRAW: Number((3.1 + (seed % 7) / 10).toFixed(2)),
    TEAM_B: Number((1.88 + ((seed + 5) % 11) / 100).toFixed(2)),
  };
}

function normalizeEvent(event, league) {
  const startTime = event.strTimestamp || `${event.dateEvent}T${event.strTime || '00:00:00'}`;
  const endTime = new Date(new Date(startTime).getTime() + 2 * 60 * 60 * 1000).toISOString();
  const status = normalizeStatus(event.strStatus, startTime, endTime);

  return {
    id: event.idEvent,
    source: 'TheSportsDB',
    league: event.strLeague || league.label,
    sport: event.strSport || league.sport,
    teamA: event.strHomeTeam,
    teamB: event.strAwayTeam,
    teamABadge: event.strHomeTeamBadge || null,
    teamBBadge: event.strAwayTeamBadge || null,
    startTime,
    endTime,
    status,
    result: status === 'COMPLETED' ? deriveResult(event) : null,
    homeScore: event.intHomeScore,
    awayScore: event.intAwayScore,
    venue: event.strVenue || '',
    country: event.strCountry || '',
    playersCount: 100 + ((Number(event.idEvent || 0) || 0) % 250),
    predictionOdds: deriveOdds(event),
    tags: [status === 'LIVE' ? 'LIVE' : 'HOT', 'PREMIUM'],
    banner: event.strThumb || event.strBanner || event.strPoster || 'https://images.unsplash.com/photo-1547347298-4074fc3086f0?w=1200&h=800&fit=crop',
  };
}

async function fetchLeagueEvents(league) {
  let merged = [];

  if (league.sport === 'Cricket') {
    const seasonRes = await fetch(`${SPORTS_DB_BASE}/eventsseason.php?id=${league.id}&s=${encodeURIComponent(league.season)}`);
    const seasonJson = seasonRes.ok ? await seasonRes.json() : { events: [] };
    merged = seasonJson.events || [];
  } else {
    const [nextRes, lastRes] = await Promise.all([
      fetch(`${SPORTS_DB_BASE}/eventsnextleague.php?id=${league.id}`),
      fetch(`${SPORTS_DB_BASE}/eventslastleague.php?id=${league.id}`),
    ]);

    const nextJson = nextRes.ok ? await nextRes.json() : { events: [] };
    const lastJson = lastRes.ok ? await lastRes.json() : { events: [] };
    merged = [...(nextJson.events || []), ...(lastJson.events || [])];
  }

  return merged
    .filter((event) => event?.idEvent && event?.strHomeTeam && event?.strAwayTeam)
    .map((event) => normalizeEvent(event, league));
}

async function loadMatches() {
  if (Date.now() < cache.expiresAt && cache.matches.length > 0) {
    return cache;
  }

  const bundles = await Promise.allSettled(LEAGUES.map(fetchLeagueEvents));
  const events = bundles
    .filter((item) => item.status === 'fulfilled')
    .flatMap((item) => item.value);

  const deduped = [];
  const byId = new Map();
  for (const match of events) {
    if (byId.has(match.id)) continue;
    byId.set(match.id, match);
    deduped.push(match);
  }

  deduped.sort((a, b) => {
    const distanceA = Math.abs(new Date(a.startTime).getTime() - Date.now());
    const distanceB = Math.abs(new Date(b.startTime).getTime() - Date.now());
    return distanceA - distanceB;
  });
  cache = {
    expiresAt: Date.now() + CACHE_MS,
    matches: deduped.slice(0, 24),
    byId,
  };

  return cache;
}

async function ensureSportGame() {
  const game = await prisma.game.findFirst({ where: { name: 'Sport' } });
  if (!game) throw new Error('Sport game is not available');
  return game;
}

async function settlePendingBets(userId = null) {
  const sportGame = await ensureSportGame();
  const matchBundle = await loadMatches();

  const where = { gameId: sportGame.id, status: 'PENDING' };
  if (userId) where.userId = userId;

  const pendingBets = await prisma.gameBet.findMany({ where, orderBy: { createdAt: 'asc' } });
  for (const bet of pendingBets) {
    const meta = bet.selection ? JSON.parse(bet.selection) : {};
    const match = matchBundle.byId.get(meta.matchId);
    if (!match || match.status !== 'COMPLETED' || !match.result) continue;

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
          selection: JSON.stringify({ ...meta, result: match.result, homeScore: match.homeScore, awayScore: match.awayScore }),
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
        await tx.user.update({ where: { id: bet.userId }, data: { gamesPlayed: { increment: 1 } } });
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
            score: `${match.homeScore ?? '-'}-${match.awayScore ?? '-'}`,
          }),
        },
      });
    });
  }
}

export async function getSportMatches(userId) {
  await settlePendingBets(userId);
  const sportGame = await ensureSportGame();
  const matchBundle = await loadMatches();
  const myBets = await prisma.gameBet.findMany({
    where: { userId, gameId: sportGame.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const byMatch = new Map();
  myBets.forEach((bet) => {
    const meta = bet.selection ? JSON.parse(bet.selection) : {};
    if (meta.matchId && !byMatch.has(meta.matchId)) {
      byMatch.set(meta.matchId, { ...bet, meta });
    }
  });

  return matchBundle.matches.map((match) => ({
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

export async function getSportMatchesPublic() {
  const matchBundle = await loadMatches();
  return matchBundle.matches;
}

export async function placeSportBet(userId, { matchId, prediction, betAmount }) {
  await settlePendingBets(userId);
  const sportGame = await ensureSportGame();
  const matchBundle = await loadMatches();
  const match = matchBundle.byId.get(matchId);

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
      roundId: matchId,
    },
  });
  if (existing) throw new Error('You already placed a prediction for this match');

  const odds = match.predictionOdds[prediction];
  const balanceBefore = user.balance;
  const balanceAfter = user.balance - betAmount;

  const bet = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { balance: balanceAfter } });
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
          source: match.source,
          league: match.league,
        }),
      },
    });
  });

  return { betId: bet.id, balanceAfter, matchId, odds, prediction };
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
      score: meta.homeScore !== undefined ? `${meta.homeScore}-${meta.awayScore}` : null,
      createdAt: bet.createdAt,
    };
  });
}
