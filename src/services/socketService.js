import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { initializeAviator, getAviatorStateForUser } from './aviatorService.js';
import { getSportMatchesPublic } from './sportPredictionService.js';

const prisma = new PrismaClient();
let io;
let sportBroadcastInterval = null;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const MATCHMAKING_QUEUE = new Map();
const ACTIVE_GAMES = new Map();

export function initializeSocket(server) {
  io = new Server(server, {
    cors: {
      origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (
          origin.includes('localhost') || 
          origin.includes('127.0.0.1') ||
          origin.includes('netlify.app')
        ) {
          return callback(null, true);
        }
        callback(null, true);
      },
      credentials: true
    }
  });

  initializeAviator(io);
  initializeSportBroadcast();

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });
      
      if (!user) {
        return next(new Error('User not found'));
      }
      
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.user.id})`);
    
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`👤 User ${userId} joined their room`);
    });

    socket.on('leave', (userId) => {
      socket.leave(`user_${userId}`);
      console.log(`👤 User ${userId} left their room`);
    });

    socket.on('aviator:join', () => {
      socket.join('aviator');
      socket.emit('aviator:state', getAviatorStateForUser(socket.user.id));
    });

    socket.on('aviator:leave', () => {
      socket.leave('aviator');
    });

    socket.on('sport:join', async () => {
      socket.join('sport');
      try {
        const matches = await getSportMatchesPublic();
        socket.emit('sport:matches', { matches, updatedAt: new Date().toISOString() });
      } catch (error) {
        socket.emit('error', { message: 'Failed to load live sport matches' });
      }
    });

    socket.on('sport:leave', () => {
      socket.leave('sport');
    });

    socket.on('join_matchmaking', async ({ betAmount }) => {
      try {
        if (socket.user.balance < betAmount) {
          socket.emit('error', { message: 'Insufficient balance' });
          return;
        }

        const queueKey = `${betAmount}`;
        if (!MATCHMAKING_QUEUE.has(queueKey)) {
          MATCHMAKING_QUEUE.set(queueKey, []);
        }

        const queue = MATCHMAKING_QUEUE.get(queueKey);
        const existingIndex = queue.findIndex(item => item.socketId === socket.id);
        
        if (existingIndex !== -1) {
          queue.splice(existingIndex, 1);
        }

        if (queue.length > 0) {
          const opponent = queue.shift();
          
          if (opponent.socketId === socket.id) {
            queue.push({ socketId: socket.id, userId: socket.user.id, name: socket.user.name, betAmount });
            socket.emit('waiting_for_match');
            return;
          }

          const opponentSocket = io.sockets.sockets.get(opponent.socketId);
          if (!opponentSocket) {
            queue.push({ socketId: socket.id, userId: socket.user.id, name: socket.user.name, betAmount });
            socket.emit('waiting_for_match');
            return;
          }

          const colors = ['palegreen', 'royalblue'];
          const randomIndex = Math.floor(Math.random() * 2);
          const player1Color = colors[randomIndex];
          const player2Color = colors[1 - randomIndex];

          const newGameId = uuidv4();
          const gameData = {
            id: newGameId,
            betAmount,
            currentTurn: 'palegreen',
            players: [
              { userId: opponent.userId, name: opponent.name, color: player1Color },
              { userId: socket.user.id, name: socket.user.name, color: player2Color },
            ],
            coinState: getInitialCoinState(),
            blockState: {},
            gameOver: false,
            winner: null,
          };

          ACTIVE_GAMES.set(newGameId, gameData);

          socket.join(newGameId);
          socket.gameId = newGameId;
          opponentSocket.join(newGameId);
          opponentSocket.gameId = newGameId;

          await deductBetFromPlayers([opponent.userId, socket.user.id], betAmount);

          socket.emit('match_found', { game: gameData, players: gameData.players });
          opponentSocket.emit('match_found', { game: gameData, players: gameData.players });

        } else {
          queue.push({ socketId: socket.id, userId: socket.user.id, name: socket.user.name, betAmount });
          socket.emit('waiting_for_match');
        }

      } catch (error) {
        console.error('Matchmaking error:', error);
        socket.emit('error', { message: 'Matchmaking failed' });
      }
    });

    socket.on('leave_matchmaking', () => {
      for (const [key, queue] of MATCHMAKING_QUEUE) {
        const index = queue.findIndex(item => item.socketId === socket.id);
        if (index !== -1) {
          queue.splice(index, 1);
        }
      }
      socket.emit('matchmaking_cancelled');
    });

    socket.on('roll_dice', ({ gameId }) => {
      const game = ACTIVE_GAMES.get(gameId);
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      const currentPlayerData = game.players.find(p => p.userId === socket.user.id);
      if (!currentPlayerData || currentPlayerData.color !== game.currentTurn) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      const diceValue = Math.floor(Math.random() * 6) + 1;
      
      io.to(gameId).emit('dice_rolled', {
        value: diceValue,
        currentPlayer: game.currentTurn,
        rolledBy: socket.user.id,
      });
    });

    socket.on('move_coin', async ({ gameId, color, coinIndex }) => {
      const game = ACTIVE_GAMES.get(gameId);
      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      const currentPlayerData = game.players.find(p => p.userId === socket.user.id);
      if (!currentPlayerData || currentPlayerData.color !== game.currentTurn) {
        socket.emit('error', { message: 'Not your turn' });
        return;
      }

      const result = processMove(game, color, coinIndex);
      
      if (result.error) {
        socket.emit('error', { message: result.error });
        return;
      }

      if (result.gameOver) {
        game.gameOver = true;
        game.winner = result.winner;
        
        io.to(gameId).emit('game_over', {
          winner: result.winner,
          reward: game.betAmount * 2,
        });

        await handleGameEnd(gameId, result.winner, game.betAmount);
      } else {
        game.currentTurn = result.nextTurn;
        game.coinState = result.coinState;
        game.blockState = result.blockState;

        io.to(gameId).emit('coin_moved', {
          color,
          coinIndex,
          coinState: result.coinState,
          blockState: result.blockState,
          message: result.message,
          type: result.type,
        });

        io.to(gameId).emit('turn_changed', {
          currentPlayer: result.nextTurn,
        });
      }
    });

    socket.on('leave_game', ({ gameId }) => {
      handlePlayerLeave(socket, gameId);
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user?.name}`);
      
      for (const [key, queue] of MATCHMAKING_QUEUE) {
        const index = queue.findIndex(item => item.socketId === socket.id);
        if (index !== -1) {
          queue.splice(index, 1);
        }
      }

      if (socket.gameId) {
        handlePlayerLeave(socket, socket.gameId);
      }
    });
  });

  return io;
}

function initializeSportBroadcast() {
  if (sportBroadcastInterval) return;

  const broadcast = async () => {
    try {
      const matches = await getSportMatchesPublic();
      io?.to('sport').emit('sport:matches', {
        matches,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Sport broadcast error:', error.message);
    }
  };

  broadcast();
  sportBroadcastInterval = setInterval(broadcast, 30000);
}

function getInitialCoinState() {
  return {
    palegreen: {
      p0: { position: 'home', isTurnAvailable: true },
      p1: { position: 'home', isTurnAvailable: true },
      p2: { position: 'home', isTurnAvailable: true },
      p3: { position: 'home', isTurnAvailable: true },
    },
    royalblue: {
      r0: { position: 'home', isTurnAvailable: true },
      r1: { position: 'home', isTurnAvailable: true },
      r2: { position: 'home', isTurnAvailable: true },
      r3: { position: 'home', isTurnAvailable: true },
    },
  };
}

async function deductBetFromPlayers(playerIds, betAmount) {
  try {
    for (const userId of playerIds) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        await prisma.user.update({
          where: { id: userId },
          data: { balance: user.balance - betAmount },
        });

        await prisma.coinTransaction.create({
          data: {
            userId,
            type: 'GAME_LOSS',
            amount: -betAmount,
            balanceBefore: user.balance,
            balanceAfter: user.balance - betAmount,
            remark: `Ludo multiplayer bet of ${betAmount} coins`,
          },
        });
      }
    }
  } catch (error) {
    console.error('Error deducting bet:', error);
  }
}

async function handleGameEnd(gameId, winnerColor, betAmount) {
  const game = ACTIVE_GAMES.get(gameId);
  if (!game) return;

  const winner = game.players.find(p => p.color === winnerColor);
  if (!winner) return;

  try {
    await prisma.ludoGame.updateMany({
      where: { id: gameId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    const winnerUser = await prisma.user.findUnique({ where: { id: winner.userId } });
    if (winnerUser) {
      const reward = betAmount * 2;
      await prisma.user.update({
        where: { id: winner.userId },
        data: {
          balance: winnerUser.balance + reward,
          gamesWon: winnerUser.gamesWon + 1,
        },
      });

      await prisma.coinTransaction.create({
        data: {
          userId: winner.userId,
          type: 'GAME_WIN',
          amount: reward,
          balanceBefore: winnerUser.balance,
          balanceAfter: winnerUser.balance + reward,
          remark: `Ludo multiplayer win - ${reward} coins`,
        },
      });
    }

    const loser = game.players.find(p => p.color !== winnerColor);
    if (loser) {
      const loserUser = await prisma.user.findUnique({ where: { id: loser.userId } });
      if (loserUser) {
        await prisma.user.update({
          where: { id: loser.userId },
          data: {
            gamesPlayed: loserUser.gamesPlayed + 1,
          },
        });
      }
    }

    ACTIVE_GAMES.delete(gameId);
  } catch (error) {
    console.error('Error handling game end:', error);
  }
}

function handlePlayerLeave(socket, gameId) {
  const game = ACTIVE_GAMES.get(gameId);
  if (!game) return;

  const leavingPlayer = game.players.find(p => p.userId === socket.user.id);
  if (!leavingPlayer) return;

  const remainingPlayer = game.players.find(p => p.userId !== socket.user.id);
  
  game.gameOver = true;
  game.winner = remainingPlayer?.color;
  
  io.to(gameId).emit('player_left', {
    userId: socket.user.id,
    name: leavingPlayer.name,
    gameOver: true,
    winner: remainingPlayer?.color,
  });

  io.to(gameId).emit('game_over', {
    winner: remainingPlayer?.color,
    abandoned: true,
    reward: remainingPlayer ? game.betAmount : 0,
  });

  ACTIVE_GAMES.delete(gameId);
  socket.leave(gameId);
}

function processMove(game, color, coinIndex) {
  const coin = game.coinState[color][coinIndex];
  const oldPosition = coin.position;
  
  if (coin.position === 'home') {
    coin.position = color === 'palegreen' ? 'p40' : 'r12';
    coin.isTurnAvailable = false;
  } else {
    const moves = getMoves(color);
    const currentIndex = moves.indexOf(coin.position);
    const newIndex = currentIndex + 1;
    
    if (newIndex >= moves.length) {
      coin.position = `${color[0]}-won`;
      coin.isTurnAvailable = false;
    } else {
      const newPosition = moves[newIndex];
      coin.position = newPosition;
      coin.isTurnAvailable = false;
      
      if (!game.blockState[newPosition]) {
        game.blockState[newPosition] = [];
      }
      game.blockState[newPosition].push(`${color[0]}${coinIndex}`);
      
      if (oldPosition && game.blockState[oldPosition]) {
        const idx = game.blockState[oldPosition].indexOf(`${color[0]}${coinIndex}`);
        if (idx !== -1) {
          game.blockState[oldPosition].splice(idx, 1);
        }
      }

      const opponentColor = color === 'palegreen' ? 'royalblue' : 'palegreen';
      if (game.blockState[newPosition].length === 1 && !isSafeZone(newPosition)) {
        const [oppKey] = game.blockState[newPosition];
        if (oppKey && oppKey[0] !== color[0]) {
          game.coinState[opponentColor][oppKey].position = 'home';
          game.blockState[newPosition] = game.blockState[newPosition].filter(k => k[0] === color[0]);
          
          return {
            coinState: game.coinState,
            blockState: game.blockState,
            nextTurn: color,
            message: `${color} captured ${opponentColor}'s token!`,
            type: 'success',
          };
        }
      }
    }
  }

  if (checkWin(game, color)) {
    return {
      gameOver: true,
      winner: color,
      coinState: game.coinState,
      blockState: game.blockState,
    };
  }

  return {
    coinState: game.coinState,
    blockState: game.blockState,
    nextTurn: color === 'palegreen' ? 'royalblue' : 'palegreen',
    message: '',
  };
}

function getMoves(color) {
  if (color === 'palegreen') {
    return ['p40', 'p30', 'p20', 'p10', 'p00', 'r50', 'r40', 'r30', 'r20', 'r10', 'r00', 'r01', 'r02', 'r12', 'r22', 'r32', 'r42', 'r52', 't02', 't12', 't22', 't32', 't42', 't52', 't51', 't50', 't40', 't30', 't20', 't10', 't00', 'p02', 'p12', 'p22', 'p32', 'p42', 'p52', 'p51', 'p50', 'p-won'];
  }
  return ['r12', 'r22', 'r32', 'r42', 'r52', 't02', 't12', 't22', 't32', 't42', 't52', 't51', 't50', 't40', 't30', 't20', 't10', 't00', 'p02', 'p12', 'p22', 'p32', 'p42', 'p52', 'p51', 'p50', 'p40', 'p30', 'p20', 'p10', 'p00', 'r50', 'r40', 'r30', 'r20', 'r10', 'r00', 'r01', 'r-won'];
}

function isSafeZone(position) {
  const safePositions = ['p40', 'r12', 'r50', 'p00', 't52', 't00', 'r-won', 'p-won'];
  return safePositions.includes(position);
}

function checkWin(game, color) {
  const tokens = game.coinState[color];
  return Object.values(tokens).every(t => t.position.includes('won'));
}

export function getIO() {
  return io;
}

export async function broadcastNotification(title, message, type = 'GENERAL', bonusCode = null, bonusCoins = null, createdBy = null) {
  try {
    const broadcast = await prisma.broadcastNotification.create({
      data: {
        title,
        message,
        type,
        bonusCode,
        bonusCoins,
        createdBy
      }
    });

    if (io) {
      io.emit('new_notification', {
        id: broadcast.id,
        title,
        message,
        type,
        bonusCode,
        bonusCoins,
        createdAt: broadcast.createdAt
      });
    }

    return broadcast;
  } catch (error) {
    console.error('Broadcast error:', error);
    throw error;
  }
}

export async function notifyUser(userId, title, message, type = 'GENERAL', data = null) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        data: data ? JSON.stringify(data) : null
      }
    });

    if (io) {
      io.to(`user_${userId}`).emit('new_notification', notification);
    }

    return notification;
  } catch (error) {
    console.error('Notify user error:', error);
    throw error;
  }
}
