import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function generateReferralCode() {
  return 'INDIA' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function main() {
  console.log('Seeding database...\n');

  // ==================== ADMINS ====================
  
  // Create Super Admin
  const hashedSuperAdminPassword = await bcrypt.hash('super123', 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@indiaplay.com' },
    update: {},
    create: {
      name: 'Admin Master',
      email: 'superadmin@indiaplay.com',
      phone: '9876543210',
      password: hashedSuperAdminPassword,
      role: 'SUPER_ADMIN',
      balance: 100000,
      bonusBalance: 10000,
      referralCode: 'ADMIN001',
      totalDeposited: 50000,
      totalWithdrawn: 10000,
      gamesPlayed: 500,
      gamesWon: 300
    }
  });
  console.log('✅ SUPER ADMIN CREATED:');
  console.log('   Email: superadmin@indiaplay.com');
  console.log('   Password: super123');
  console.log('   Balance: ₹100,000\n');

  // Create Sub Admin
  const hashedSubAdminPassword = await bcrypt.hash('admin123', 12);
  const subAdmin = await prisma.user.upsert({
    where: { email: 'subadmin@indiaplay.com' },
    update: {},
    create: {
      name: 'Vikram Singh',
      email: 'subadmin@indiaplay.com',
      phone: '9876543211',
      password: hashedSubAdminPassword,
      role: 'SUB_ADMIN',
      balance: 50000,
      bonusBalance: 5000,
      referralCode: 'ADMIN002',
      totalDeposited: 25000,
      gamesPlayed: 250,
      gamesWon: 150
    }
  });
  console.log('✅ SUB ADMIN CREATED:');
  console.log('   Email: subadmin@indiaplay.com');
  console.log('   Password: admin123');
  console.log('   Balance: ₹50,000\n');

  // ==================== REGULAR USERS ====================
  
  const users = [
    {
      name: 'Rajesh Kumar',
      email: 'player@example.com',
      phone: '9876543212',
      password: 'user123',
      balance: 5000,
      bonusBalance: 500,
      totalWinnings: 12000,
      gamesPlayed: 120,
      gamesWon: 65,
      streak: 5,
      referralCode: 'RAJESH01'
    },
    {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '9876543213',
      password: 'user123',
      balance: 8500,
      bonusBalance: 1000,
      totalWinnings: 25000,
      gamesPlayed: 200,
      gamesWon: 110,
      streak: 12,
      referralCode: 'PRIYA01'
    },
    {
      name: 'Amit Patel',
      email: 'amit@example.com',
      phone: '9876543214',
      password: 'user123',
      balance: 3200,
      bonusBalance: 200,
      totalWinnings: 8000,
      gamesPlayed: 85,
      gamesWon: 42,
      streak: 3,
      referralCode: 'AMIT01'
    },
    {
      name: 'Sneha Gupta',
      email: 'sneha@example.com',
      phone: '9876543215',
      password: 'user123',
      balance: 15000,
      bonusBalance: 2500,
      totalWinnings: 45000,
      gamesPlayed: 350,
      gamesWon: 200,
      streak: 25,
      referralCode: 'SNEHA01'
    },
    {
      name: 'Rahul Verma',
      email: 'rahul@example.com',
      phone: '9876543216',
      password: 'user123',
      balance: 1500,
      bonusBalance: 100,
      totalWinnings: 3000,
      gamesPlayed: 45,
      gamesWon: 20,
      streak: 2,
      referralCode: 'RAHUL01'
    },
    {
      name: 'Kavita Joshi',
      email: 'kavita@example.com',
      phone: '9876543217',
      password: 'user123',
      balance: 22000,
      bonusBalance: 3000,
      totalWinnings: 65000,
      gamesPlayed: 450,
      gamesWon: 280,
      streak: 30,
      referralCode: 'KAVITA01'
    },
    {
      name: 'Suresh Nair',
      email: 'suresh@example.com',
      phone: '9876543218',
      password: 'user123',
      balance: 4500,
      bonusBalance: 400,
      totalWinnings: 15000,
      gamesPlayed: 150,
      gamesWon: 78,
      streak: 8,
      referralCode: 'SURY01'
    },
    {
      name: 'Meera Reddy',
      email: 'meera@example.com',
      phone: '9876543219',
      password: 'user123',
      balance: 12000,
      bonusBalance: 1500,
      totalWinnings: 35000,
      gamesPlayed: 280,
      gamesWon: 155,
      streak: 15,
      referralCode: 'MEERA01'
    },
    {
      name: 'Arjun Mehta',
      email: 'arjun@example.com',
      phone: '9876543220',
      password: 'user123',
      balance: 800,
      bonusBalance: 50,
      totalWinnings: 1500,
      gamesPlayed: 25,
      gamesWon: 10,
      streak: 1,
      referralCode: 'ARJUN01'
    },
    {
      name: 'Divya Iyer',
      email: 'divya@example.com',
      phone: '9876543221',
      password: 'user123',
      balance: 35000,
      bonusBalance: 5000,
      totalWinnings: 95000,
      gamesPlayed: 600,
      gamesWon: 380,
      streak: 50,
      referralCode: 'DIVYA01'
    }
  ];

  for (const userData of users) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        password: hashedPassword,
        role: 'USER',
        balance: userData.balance,
        bonusBalance: userData.bonusBalance,
        totalWinnings: userData.totalWinnings,
        gamesPlayed: userData.gamesPlayed,
        gamesWon: userData.gamesWon,
        streak: userData.streak,
        referralCode: userData.referralCode,
        totalDeposited: userData.balance * 3,
        lastLoginAt: new Date()
      }
    });
    console.log(`✅ Created: ${user.name}`);
  }

  console.log('\n');

  // ==================== DEPOSIT PLANS ====================
  
  const depositPlanCount = await prisma.depositPlan.count();
  if (depositPlanCount === 0) {
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
    console.log('✅ Created 6 Deposit Plans');
  }

  // ==================== BONUS CODES ====================
  
  const bonusCodeCount = await prisma.bonusCode.count();
  if (bonusCodeCount === 0) {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    await prisma.bonusCode.createMany({
      data: [
        { code: 'WELCOME50', coinAmount: 50, discountPercent: 0, description: 'Welcome bonus - Get 50 free coins!', maxUses: 1000, startsAt: now, expiresAt: nextMonth },
        { code: 'PLAY100', coinAmount: 100, discountPercent: 0, description: 'Play and win - 100 free coins!', maxUses: 500, startsAt: now, expiresAt: nextMonth },
        { code: 'LUCKY200', coinAmount: 200, discountPercent: 0, description: 'Lucky draw - 200 free coins!', maxUses: 200, startsAt: now, expiresAt: nextMonth },
        { code: 'VIP500', coinAmount: 500, discountPercent: 10, description: 'VIP bonus - 500 coins + 10% extra!', minDeposit: 1000, maxUses: 100, startsAt: now, expiresAt: nextMonth },
        { code: 'FESTIVE1000', coinAmount: 1000, discountPercent: 20, description: 'Festival special - 1000 coins + 20% extra!', minDeposit: 5000, maxUses: 50, startsAt: now, expiresAt: nextMonth },
        { code: 'INDIA50', coinAmount: 50, discountPercent: 0, description: 'IndiaPlay special - 50 free coins!', maxUses: 1000, startsAt: now, expiresAt: nextMonth }
      ]
    });
    console.log('✅ Created 6 Bonus Codes');
  }

  // ==================== GAMES ====================
  
  const gameCount = await prisma.game.count();
  if (gameCount === 0) {
    await prisma.game.createMany({
      data: [
        { 
          name: 'Ludo Master', 
          description: 'Classic dice game - Roll dice, move tokens, beat the AI!', 
          category: 'Board', 
          minBet: 10, 
          maxBet: 5000, 
          maxWin: 10000, 
          color: '#ec4899', 
          icon: 'Gamepad2', 
          isHot: true, 
          isFeatured: true, 
          players: 500000,
          image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=400&fit=crop'
        },
        { 
          name: 'Teen Patti', 
          description: '3 Patti card game with exciting stakes!', 
          category: 'Card', 
          minBet: 10, 
          maxBet: 10000, 
          maxWin: 50000, 
          color: '#f59e0b', 
          icon: 'Cards', 
          isHot: true, 
          isFeatured: false, 
          players: 250000
        },
        { 
          name: 'Andar Bahar', 
          description: 'Predict which side the card will appear!', 
          category: 'Card', 
          minBet: 10, 
          maxBet: 10000, 
          maxWin: 50000, 
          color: '#10b981', 
          icon: 'Sparkles', 
          isHot: true, 
          isFeatured: false, 
          players: 200000
        },
        { 
          name: 'Rummy', 
          description: 'Classic Indian Rummy card game!', 
          category: 'Card', 
          minBet: 100, 
          maxBet: 5000, 
          maxWin: 25000, 
          color: '#8b5cf6', 
          icon: 'Layers', 
          isHot: false, 
          isFeatured: true, 
          players: 150000
        }
      ]
    });
    console.log('✅ Created 4 Games');
  }

  // ==================== ACHIEVEMENTS ====================
  
  const achievementCount = await prisma.achievement.count();
  if (achievementCount === 0) {
    await prisma.achievement.createMany({
      data: [
        { name: 'First Win', description: 'Win your first game', icon: 'Trophy', type: 'GAMES_WON', target: 1, reward: 50, rarity: 'Common', color: '#6b7280' },
        { name: 'Lucky Beginner', description: 'Win 10 games', icon: 'Star', type: 'GAMES_WON', target: 10, reward: 200, rarity: 'Common', color: '#22c55e' },
        { name: 'Skilled Player', description: 'Win 50 games', icon: 'Zap', type: 'GAMES_WON', target: 50, reward: 1000, rarity: 'Rare', color: '#3b82f6' },
        { name: 'Master Strategist', description: 'Win 100 games', icon: 'Crown', type: 'GAMES_WON', target: 100, reward: 2500, rarity: 'Epic', color: '#8b5cf6' },
        { name: 'Legendary Winner', description: 'Win 500 games', icon: 'Gem', type: 'GAMES_WON', target: 500, reward: 10000, rarity: 'Legendary', color: '#f59e0b' },
        { name: 'Getting Started', description: 'Play 10 games', icon: 'Play', type: 'GAMES_PLAYED', target: 10, reward: 100, rarity: 'Common', color: '#6b7280' },
        { name: 'Regular Player', description: 'Play 100 games', icon: 'Heart', type: 'GAMES_PLAYED', target: 100, reward: 500, rarity: 'Rare', color: '#3b82f6' },
        { name: 'Dedicated Gamer', description: 'Play 500 games', icon: 'Fire', type: 'GAMES_PLAYED', target: 500, reward: 2500, rarity: 'Epic', color: '#8b5cf6' },
        { name: 'Big Winner', description: 'Win ₹10,000 in a single game', icon: 'Coins', type: 'SINGLE_WIN', target: 10000, reward: 500, rarity: 'Rare', color: '#3b82f6' },
        { name: 'Mega Winner', description: 'Win ₹50,000 in a single game', icon: 'Sparkles', type: 'SINGLE_WIN', target: 50000, reward: 2000, rarity: 'Epic', color: '#8b5cf6' },
        { name: 'Hot Streak', description: 'Win 10 games in a row', icon: 'Flame', type: 'STREAK', target: 10, reward: 1000, rarity: 'Rare', color: '#3b82f6' },
        { name: 'Unstoppable', description: 'Win 25 games in a row', icon: 'Rocket', type: 'STREAK', target: 25, reward: 5000, rarity: 'Epic', color: '#8b5cf6' },
        { name: 'First Deposit', description: 'Make your first deposit', icon: 'Wallet', type: 'DEPOSIT', target: 1, reward: 100, rarity: 'Common', color: '#6b7280' },
        { name: 'Big Investor', description: 'Deposit ₹10,000 total', icon: 'Banknote', type: 'DEPOSIT', target: 10000, reward: 500, rarity: 'Rare', color: '#3b82f6' },
        { name: 'Referral Champion', description: 'Refer 5 friends', icon: 'Users', type: 'REFERRAL', target: 5, reward: 250, rarity: 'Rare', color: '#3b82f6' },
        { name: 'Daily Visitor', description: 'Login 7 days in a row', icon: 'Calendar', type: 'DAILY_LOGIN', target: 7, reward: 150, rarity: 'Common', color: '#6b7280' },
        { name: 'Weekly Regular', description: 'Login 30 days in a row', icon: 'CalendarCheck', type: 'DAILY_LOGIN', target: 30, reward: 1000, rarity: 'Rare', color: '#3b82f6' }
      ]
    });
    console.log('✅ Created 17 Achievements');
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('          SEEDING COMPLETE!');
  console.log('═══════════════════════════════════════════');
  console.log('\n📋 TEST ACCOUNTS:\n');
  console.log('┌─────────────────┬──────────────────────────────┬────────────┬─────────────────┐');
  console.log('│ Role            │ Email                         │ Password   │ Balance         │');
  console.log('├─────────────────┼──────────────────────────────┼────────────┼─────────────────┤');
  console.log('│ SUPER ADMIN      │ superadmin@indiaplay.com      │ super123   │ ₹100,000        │');
  console.log('│ SUB ADMIN       │ subadmin@indiaplay.com       │ admin123   │ ₹50,000         │');
  console.log('│ USER            │ player@example.com           │ user123    │ ₹5,000          │');
  console.log('│ USER            │ priya@example.com            │ user123    │ ₹8,500          │');
  console.log('│ USER            │ sneha@example.com            │ user123    │ ₹15,000         │');
  console.log('│ USER            │ kavita@example.com           │ user123    │ ₹22,000         │');
  console.log('│ USER            │ meera@example.com            │ user123    │ ₹12,000         │');
  console.log('│ USER            │ divya@example.com            │ user123    │ ₹35,000         │');
  console.log('│ USER            │ amit@example.com             │ user123    │ ₹3,200          │');
  console.log('│ USER            │ rahul@example.com            │ user123    │ ₹1,500          │');
  console.log('│ USER            │ suresh@example.com           │ user123    │ ₹4,500          │');
  console.log('│ USER            │ arjun@example.com            │ user123    │ ₹800            │');
  console.log('└─────────────────┴──────────────────────────────┴────────────┴─────────────────┘');
  console.log('\n🎁 Bonus Codes: WELCOME50, PLAY100, LUCKY200, VIP500, FESTIVE1000, INDIA50');
  console.log('\n🎮 Games: Ludo Master, Teen Patti, Andar Bahar, Rummy');
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
