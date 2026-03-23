import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SAFE_ZONES = [0, 6, 13, 19];
const HOME_POSITION = 14;
const HOME_PATH_LENGTH = 4;

// Blue travels clockwise from start
const BLUE_TRACK = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
// Red travels counter-clockwise from opposite start
const RED_TRACK = [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

const initializeBoard = () => ({
  USER: [
    { position: -1, finished: false },
    { position: -1, finished: false },
    { position: -1, finished: false },
    { position: -1, finished: false }
  ],
  AI: [
    { position: -1, finished: false },
    { position: -1, finished: false },
    { position: -1, finished: false },
    { position: -1, finished: false }
  ],
  currentTurn: 'USER',
  diceValue: 0,
  lastDice: 0,
  gameOver: false,
  winner: null
});

const getValidMoves = (board, player, diceValue) => {
  const validMoves = [];
  const tokens = board[player];
  
  for (let i = 0; i < 4; i++) {
    const token = tokens[i];
    if (token.finished) continue;
    
    // Token in home - needs 6 to come out
    if (token.position === -1) {
      if (diceValue === 6) validMoves.push(i);
    } 
    // Token on track - can move forward
    else {
      const newPos = token.position + diceValue;
      // Can enter home path (positions 14-17)
      if (newPos <= HOME_POSITION + HOME_PATH_LENGTH) {
        validMoves.push(i);
      }
    }
  }
  
  return validMoves;
};

const moveToken = (board, player, tokenIndex, diceValue) => {
  const tokens = board[player];
  const token = tokens[tokenIndex];
  
  // Bring token out of home
  if (token.position === -1) {
    if (diceValue === 6) {
      token.position = 0; // Start position on track
      return { moved: true, killed: false, finished: false };
    }
    return { moved: false };
  }
  
  const newPos = token.position + diceValue;
  
  // Token reaches home
  if (newPos === HOME_POSITION + HOME_PATH_LENGTH) {
    token.position = newPos;
    token.finished = true;
    return { moved: true, killed: false, finished: true };
  }
  
  // Token goes past home - can't move
  if (newPos > HOME_POSITION + HOME_PATH_LENGTH) {
    return { moved: false };
  }
  
  // Check for captures
  let killed = false;
  const oppositePlayer = player === 'USER' ? 'AI' : 'USER';
  const oppositeTokens = board[oppositePlayer];
  
  // Only check for captures on main track (positions 0-13)
  if (newPos <= HOME_POSITION && !SAFE_ZONES.includes(newPos)) {
    for (let i = 0; i < 4; i++) {
      const oppToken = oppositeTokens[i];
      if (oppToken.position !== -1 && !oppToken.finished && oppToken.position === newPos) {
        oppToken.position = -1; // Send to home
        killed = true;
        break;
      }
    }
  }
  
  token.position = newPos;
  return { moved: true, killed, finished: false };
};

const checkWin = (board, player) => {
  return board[player].every(token => token.finished);
};

export async function startGame(req, res) {
  try {
    const userId = req.user.id;
    const { betAmount, difficulty = 'EASY' } = req.body;
    
    if (!betAmount || betAmount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }
    
    if (betAmount < 10 || betAmount > 10000) {
      return res.status(400).json({ error: 'Bet amount must be between 10 and 10000' });
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const board = initializeBoard();
    const newBalance = user.balance - betAmount;
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        balance: newBalance,
        gamesPlayed: user.gamesPlayed + 1
      }
    });
    
    await prisma.coinTransaction.create({
      data: {
        userId,
        type: 'GAME_LOSS',
        amount: -betAmount,
        balanceBefore: user.balance,
        balanceAfter: newBalance,
        remark: `Ludo bet of ${betAmount} coins`
      }
    });
    
    const game = await prisma.ludoGame.create({
      data: {
        userId,
        betAmount,
        difficulty,
        status: 'IN_PROGRESS',
        gameState: JSON.stringify(board)
      }
    });
    
    res.json({
      success: true,
      game: {
        id: game.id,
        betAmount: game.betAmount,
        difficulty: game.difficulty,
        status: game.status,
        board,
        currentTurn: 'USER'
      }
    });
    
  } catch (error) {
    console.error('Start game error:', error);
    res.status(500).json({ error: 'Failed to start game', details: error.message });
  }
}

export async function rollDice(req, res) {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    
    const game = await prisma.ludoGame.findFirst({
      where: { id: gameId, userId, status: 'IN_PROGRESS' }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    let board = JSON.parse(game.gameState || '{}');
    
    if (board.currentTurn !== 'USER') {
      return res.status(400).json({ error: 'Not your turn' });
    }
    
    if (board.diceValue !== 0) {
      return res.status(400).json({ error: 'Already rolled this turn' });
    }
    
    const diceValue = Math.floor(Math.random() * 6) + 1;
    board.diceValue = diceValue;
    board.lastDice = diceValue;
    
    const validMoves = getValidMoves(board, 'USER', diceValue);
    
    if (validMoves.length === 0) {
      if (diceValue === 6) {
        await prisma.ludoGame.update({
          where: { id: gameId },
          data: { gameState: JSON.stringify(board) }
        });
        
        return res.json({
          success: true,
          diceValue,
          validMoves: [],
          canMove: false,
          needsReroll: true,
          message: 'Rolled 6 but no valid moves - roll again'
        });
      }
      
      board.currentTurn = 'AI';
      board.diceValue = 0;
      
      await prisma.ludoGame.update({
        where: { id: gameId },
        data: { gameState: JSON.stringify(board), playerTurn: 'AI' }
      });
      
      return res.json({
        success: true,
        diceValue,
        validMoves: [],
        canMove: false,
        nextTurn: 'AI',
        turnSwitched: true
      });
    }
    
    await prisma.ludoGame.update({
      where: { id: gameId },
      data: { gameState: JSON.stringify(board) }
    });
    
    res.json({
      success: true,
      diceValue,
      validMoves,
      canMove: validMoves.length > 0,
      needsReroll: diceValue === 6
    });
    
  } catch (error) {
    console.error('Roll dice error:', error);
    res.status(500).json({ error: 'Failed to roll dice' });
  }
}

export async function makeMove(req, res) {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    const { tokenIndex } = req.body;
    
    const game = await prisma.ludoGame.findFirst({
      where: { id: gameId, userId, status: 'IN_PROGRESS' }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    let board = JSON.parse(game.gameState || '{}');
    
    if (board.currentTurn !== 'USER') {
      return res.status(400).json({ error: 'Not your turn' });
    }
    
    if (board.diceValue === 0) {
      return res.status(400).json({ error: 'Roll dice first' });
    }
    
    if (tokenIndex === undefined || tokenIndex < 0 || tokenIndex > 3) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    
    const validMoves = getValidMoves(board, 'USER', board.diceValue);
    
    if (!validMoves.includes(tokenIndex)) {
      return res.status(400).json({ error: 'Invalid move' });
    }
    
    const moveResult = moveToken(board, 'USER', tokenIndex, board.diceValue);
    
    if (!moveResult.moved) {
      return res.status(400).json({ error: 'Cannot move token' });
    }
    
    // Check for win
    const userWon = checkWin(board, 'USER');
    if (userWon) {
      board.gameOver = true;
      board.winner = 'USER';
      
      const reward = game.betAmount * 2;
      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      
      await prisma.user.update({
        where: { id: userId },
        data: {
          balance: currentUser.balance + reward,
          totalWinnings: currentUser.totalWinnings + (reward - game.betAmount),
          gamesWon: currentUser.gamesWon + 1
        }
      });
      
      await prisma.coinTransaction.create({
        data: {
          userId,
          type: 'GAME_WIN',
          amount: reward,
          balanceBefore: currentUser.balance,
          balanceAfter: currentUser.balance + reward,
          remark: `Ludo win - ${reward} coins`
        }
      });
      
      await prisma.ludoGame.update({
        where: { id: gameId },
        data: {
          status: 'COMPLETED',
          userWin: true,
          reward,
          gameState: JSON.stringify(board),
          endedAt: new Date()
        }
      });
      
      return res.json({
        success: true,
        gameOver: true,
        winner: 'USER',
        reward,
        board
      });
    }
    
    // Check for extra turn (rolled 6)
    if (board.lastDice === 6) {
      board.currentTurn = 'USER';
      board.diceValue = 0;
    } else {
      board.currentTurn = 'AI';
      board.diceValue = 0;
    }
    
    await prisma.ludoGame.update({
      where: { id: gameId },
      data: { gameState: JSON.stringify(board), playerTurn: board.currentTurn }
    });
    
    res.json({
      success: true,
      moveResult,
      board,
      nextTurn: board.currentTurn,
      needsReroll: board.lastDice === 6
    });
    
  } catch (error) {
    console.error('Make move error:', error);
    res.status(500).json({ error: 'Failed to make move' });
  }
}

export async function skipTurn(req, res) {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    
    const game = await prisma.ludoGame.findFirst({
      where: { id: gameId, userId, status: 'IN_PROGRESS' }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    let board = JSON.parse(game.gameState || '{}');
    
    if (board.currentTurn !== 'USER') {
      return res.status(400).json({ error: 'Not your turn' });
    }
    
    board.currentTurn = 'AI';
    board.diceValue = 0;
    
    await prisma.ludoGame.update({
      where: { id: gameId },
      data: { gameState: JSON.stringify(board), playerTurn: 'AI' }
    });
    
    res.json({
      success: true,
      nextTurn: 'AI'
    });
    
  } catch (error) {
    console.error('Skip turn error:', error);
    res.status(500).json({ error: 'Failed to skip turn' });
  }
}

export async function aiTurn(req, res) {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    
    const game = await prisma.ludoGame.findFirst({
      where: { id: gameId, userId, status: 'IN_PROGRESS' }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    let board = JSON.parse(game.gameState || '{}');
    
    if (board.currentTurn !== 'AI') {
      return res.status(400).json({ error: 'Not AI turn' });
    }
    
    // Simulate AI thinking
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const diceValue = Math.floor(Math.random() * 6) + 1;
    board.diceValue = diceValue;
    board.lastDice = diceValue;
    
    const validMoves = getValidMoves(board, 'AI', diceValue);
    
    // No valid moves - skip turn
    if (validMoves.length === 0) {
      board.currentTurn = 'USER';
      board.diceValue = 0;
      
      await prisma.ludoGame.update({
        where: { id: gameId },
        data: { gameState: JSON.stringify(board), playerTurn: 'USER' }
      });
      
      return res.json({
        success: true,
        diceValue,
        aiMoved: false,
        board,
        nextTurn: 'USER'
      });
    }
    
    // AI makes random move
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const moveIndex = validMoves[Math.floor(Math.random() * validMoves.length)];
    const moveResult = moveToken(board, 'AI', moveIndex, diceValue);
    
    // Check for AI win
    const aiWon = checkWin(board, 'AI');
    if (aiWon) {
      board.gameOver = true;
      board.winner = 'AI';
      
      await prisma.ludoGame.update({
        where: { id: gameId },
        data: {
          status: 'COMPLETED',
          userWin: false,
          gameState: JSON.stringify(board),
          endedAt: new Date()
        }
      });
      
      return res.json({
        success: true,
        diceValue,
        moveResult,
        aiMoved: true,
        gameOver: true,
        winner: 'AI',
        board
      });
    }
    
    // Check for extra turn
    if (diceValue === 6) {
      board.currentTurn = 'AI';
      board.diceValue = 0;
    } else {
      board.currentTurn = 'USER';
      board.diceValue = 0;
    }
    
    await prisma.ludoGame.update({
      where: { id: gameId },
      data: { gameState: JSON.stringify(board), playerTurn: 'USER' }
    });
    
    res.json({
      success: true,
      diceValue,
      moveResult,
      aiMoved: true,
      board,
      nextTurn: board.currentTurn
    });
    
  } catch (error) {
    console.error('AI turn error:', error);
    res.status(500).json({ error: 'Failed to execute AI turn' });
  }
}

export async function getGameState(req, res) {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    
    const game = await prisma.ludoGame.findFirst({
      where: { id: gameId, userId }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    const board = JSON.parse(game.gameState || '{}');
    
    res.json({
      success: true,
      game: {
        id: game.id,
        betAmount: game.betAmount,
        difficulty: game.difficulty,
        status: game.status,
        userWin: game.userWin,
        reward: game.reward,
        board,
        currentTurn: board.currentTurn
      }
    });
    
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
}

export async function getGameHistory(req, res) {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    
    const games = await prisma.ludoGame.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: (parseInt(page) - 1) * parseInt(limit)
    });
    
    const total = await prisma.ludoGame.count({ where: { userId } });
    
    res.json({
      success: true,
      games: games.map(g => ({
        id: g.id,
        betAmount: g.betAmount,
        difficulty: g.difficulty,
        status: g.status,
        userWin: g.userWin,
        reward: g.reward,
        createdAt: g.createdAt,
        endedAt: g.endedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('Get game history error:', error);
    res.status(500).json({ error: 'Failed to get game history' });
  }
}

export async function forfeitGame(req, res) {
  try {
    const userId = req.user.id;
    const { gameId } = req.params;
    
    const game = await prisma.ludoGame.findFirst({
      where: { id: gameId, userId, status: 'IN_PROGRESS' }
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    await prisma.ludoGame.update({
      where: { id: gameId },
      data: {
        status: 'ABANDONED',
        userWin: false,
        endedAt: new Date()
      }
    });
    
    res.json({
      success: true,
      message: 'Game forfeited'
    });
    
  } catch (error) {
    console.error('Forfeit game error:', error);
    res.status(500).json({ error: 'Failed to forfeit game' });
  }
}

export async function startMultiplayer(req, res) {
  try {
    const userId = req.user.id;
    const { betAmount } = req.body;
    
    if (!betAmount || betAmount <= 0) {
      return res.status(400).json({ error: 'Invalid bet amount' });
    }
    
    if (betAmount < 10 || betAmount > 10000) {
      return res.status(400).json({ error: 'Bet amount must be between 10 and 10000' });
    }
    
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.balance < betAmount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    const game = await prisma.ludoGame.create({
      data: {
        userId,
        betAmount,
        difficulty: 'MEDIUM',
        status: 'PENDING',
        gameState: JSON.stringify({
          mode: 'multiplayer',
          matchmaking: true,
          createdBy: userId,
        })
      }
    });
    
    res.json({
      success: true,
      gameId: game.id,
      betAmount,
      message: 'Added to matchmaking queue'
    });
    
  } catch (error) {
    console.error('Start multiplayer error:', error);
    res.status(500).json({ error: 'Failed to start multiplayer game', details: error.message });
  }
}
