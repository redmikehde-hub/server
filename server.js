import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import config from './src/config/index.js';
import authRoutes from './src/routes/auth.js';
import userRoutes from './src/routes/user.js';
import walletRoutes from './src/routes/wallet.js';
import withdrawRoutes from './src/routes/withdraw.js';
import adminRoutes from './src/routes/admin.js';
import gamesRoutes from './src/routes/games.js';
import leaderboardRoutes from './src/routes/leaderboard.js';
import achievementsRoutes from './src/routes/achievements.js';
import bonusesRoutes from './src/routes/bonuses.js';
import notificationsRoutes from './src/routes/notifications.js';
import gameRoutes from './src/routes/game.js';
import depositRoutes from './src/routes/deposit.js';
import bonusRoutes from './src/routes/bonus.js';
import referralRoutes from './src/routes/referral.js';
import broadcastRoutes from './src/routes/broadcast.js';
import ludoRoutes from './src/routes/ludo.js';
import { PrismaClient } from '@prisma/client';
import { depositService } from './src/services/depositService.js';
import { bonusService } from './src/services/bonusService.js';
import { initializeSocket } from './src/services/socketService.js';

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);

const io = initializeSocket(server);

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (
      origin.includes('localhost') || 
      origin.includes('127.0.0.1') ||
      origin === config.frontendUrl
    ) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/withdraw', withdrawRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/bonuses', bonusesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/deposit', depositRoutes);
app.use('/api/bonus', bonusRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/broadcast', broadcastRoutes);
app.use('/api/ludo', ludoRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

async function createSuperAdmin() {
  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    });

    if (!existingAdmin) {
      const bcryptModule = await import('bcryptjs');
      const bcrypt = bcryptModule.default;
      const hashedPassword = await bcrypt.hash('SuperAdmin@123', 12);
      const referralCode = 'INDIA' + Math.random().toString(36).substring(2, 8).toUpperCase();
      
      await prisma.user.create({
        data: {
          name: 'Super Admin',
          email: 'admin@indiaplay.com',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          balance: 0,
          referralCode
        }
      });
      console.log('✅ SUPER_ADMIN created: admin@indiaplay.com / SuperAdmin@123');
    } else {
      console.log('ℹ️  SUPER_ADMIN already exists');
    }
  } catch (error) {
    console.error('Failed to create super admin:', error);
  }
}

async function seedData() {
  try {
    await depositService.createDefaultPlans();
    await bonusService.createDefaultBonusCodes();
    
    const gameCount = await prisma.game.count();
    if (gameCount === 0) {
      await prisma.game.createMany({
        data: [
          { name: 'Matka', description: 'Legendary Indian game', category: 'Popular', minBet: 10, maxBet: 10000, maxWin: 100000, color: '#f97316', icon: 'Flame', isHot: true, isFeatured: true, players: 250000, image: 'https://images.unsplash.com/photo-1580707221190-bd94d9087b7f?w=400&h=400&fit=crop' },
          { name: 'Sport', description: 'Cricket, Football betting', category: 'Popular', minBet: 100, maxBet: 50000, maxWin: 500000, color: '#22c55e', icon: 'Trophy', isHot: true, isFeatured: true, players: 500000, image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=400&fit=crop' },
          { name: 'Colour', description: 'Red, Green or Blue?', category: 'Popular', minBet: 5, maxBet: 5000, maxWin: 50000, color: '#a855f7', icon: 'Target', isHot: true, isFeatured: true, players: 1000000, image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop' },
          { name: 'Ludo', description: 'Classic dice game', category: 'Arcade', minBet: 20, maxBet: 8000, maxWin: 80000, color: '#ec4899', icon: 'Gamepad2', isHot: false, isFeatured: false, players: 350000, image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=400&fit=crop' },
          { name: 'Aviator', description: 'Cash out before crash!', category: 'Slots', minBet: 10, maxBet: 25000, maxWin: 250000, color: '#eab308', icon: 'Zap', isHot: true, isFeatured: true, players: 800000, image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=400&h=400&fit=crop' },
        ]
      });
      console.log('✅ Games seeded');
    }

    const bonusCount = await prisma.bonus.count();
    if (bonusCount === 0) {
      await prisma.bonus.createMany({
        data: [
          { code: 'WELCOME100', type: 'WELCOME', title: 'Welcome Bonus', description: 'Get 100% bonus on first deposit', percentage: 100, reward: 5000, maxBonus: 5000, minDeposit: 100, isActive: true },
          { code: 'DAILY500', type: 'DAILY', title: 'Daily Bonus', description: 'Claim your free daily bonus', percentage: 0, reward: 500, isActive: true },
          { code: 'CASHBACK10', type: 'CASHBACK', title: 'Weekly Cashback', description: 'Get 10% cashback on losses', percentage: 10, reward: 2000, maxBonus: 2000, minDeposit: 1000, isActive: true },
          { code: 'REFER200', type: 'REFER', title: 'Refer & Earn', description: '₹200 for each friend who deposits', percentage: 0, reward: 200, isActive: true },
          { code: 'DEPOSIT50', type: 'DEPOSIT', title: 'Deposit Bonus', description: 'Get 50% extra on deposits above ₹1,000', percentage: 50, reward: 5000, maxBonus: 5000, minDeposit: 1000, isActive: true },
          { code: 'HAPPY2X', type: 'PROMO', title: 'Happy Hours', description: '2x bonus between 6-9 PM', percentage: 100, reward: 2000, maxBonus: 2000, minDeposit: 500, isActive: true },
        ]
      });
      console.log('✅ Bonuses seeded');
    }

    const achievementCount = await prisma.achievement.count();
    if (achievementCount === 0) {
      await prisma.achievement.createMany({
        data: [
          { name: 'First Win', description: 'Win your first game', icon: 'Star', type: 'GAMES_WON', target: 1, reward: 100, rarity: 'Common', color: '#6b7280' },
          { name: 'Getting Started', description: 'Play 10 games', icon: 'Target', type: 'GAMES_PLAYED', target: 10, reward: 50, rarity: 'Common', color: '#6b7280' },
          { name: 'Matka Master', description: 'Win 10 Matka games', icon: 'Flame', type: 'GAMES_WON', target: 10, reward: 500, rarity: 'Rare', color: '#3b82f6' },
          { name: 'High Roller', description: 'Bet ₹10,000 in one day', icon: 'Trophy', type: 'GAMES_PLAYED', target: 20, reward: 1000, rarity: 'Epic', color: '#a855f7' },
          { name: 'Lucky Seven', description: 'Win 7 consecutive games', icon: 'Star', type: 'STREAK', target: 7, reward: 750, rarity: 'Epic', color: '#a855f7' },
          { name: 'Big Winner', description: 'Win ₹1,00,000+ in single game', icon: 'Trophy', type: 'SINGLE_WIN', target: 100000, reward: 5000, rarity: 'Legendary', color: '#f97316' },
          { name: 'Dedicated Player', description: 'Play for 7 days straight', icon: 'Crown', type: 'DAILY_LOGIN', target: 7, reward: 1000, rarity: 'Rare', color: '#3b82f6' },
          { name: 'Generous', description: 'Refer 5 friends', icon: 'Gift', type: 'REFERRAL', target: 5, reward: 500, rarity: 'Common', color: '#6b7280' },
        ]
      });
      console.log('✅ Achievements seeded');
    }
  } catch (error) {
    console.error('Failed to seed data:', error);
  }
}

async function main() {
  await createSuperAdmin();
  await seedData();
  
  server.listen(config.port, () => {
    console.log(`\n🚀 IndiaPlay Backend running on port ${config.port}`);
    console.log(`📦 Environment: ${config.nodeEnv}`);
    console.log(`🔗 API: http://localhost:${config.port}/api`);
    console.log(`🔌 Socket.io: enabled`);
    console.log(`📚 API Endpoints:`);
    console.log(`   Auth: /api/auth/register, /login, /login/phone, /google`);
    console.log(`   User: /api/user/me, /all`);
    console.log(`   Wallet: /api/wallet, /deposit, /add`);
    console.log(`   Withdraw: /api/withdraw/request, /all`);
    console.log(`   Games: /api/games, /featured, /categories`);
    console.log(`   Leaderboard: /api/leaderboard/monthly, /top`);
    console.log(`   Achievements: /api/achievements, /my`);
    console.log(`   Bonuses: /api/bonuses, /claim, /referral`);
    console.log(`   Game: /api/game/play, /history, /stats`);
    console.log(`   Deposit: /api/deposit/plans, /purchase`);
    console.log(`   Bonus: /api/bonus/apply, /create`);
    console.log(`   Referral: /api/referral/code, /list, /history`);
    console.log(`   Notifications: /api/notifications, /unread-count`);
    console.log(`   Broadcast: /api/broadcast, /admin/notify (SUPER_ADMIN only)`);
    console.log(`   Ludo: /api/ludo/start, /:id, /:id/roll, /:id/move, /:id/ai-turn, /history\n`);
  });
}

main().catch(console.error);

export default app;
