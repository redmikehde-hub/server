import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function generateReferralCode() {
  return 'INDIA' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function main() {
  console.log('Seeding database...\n');

  // Create regular user
  const hashedUserPassword = await bcrypt.hash('user123', 12);
  const userReferralCode = generateReferralCode();
  
  const user = await prisma.user.upsert({
    where: { email: 'player@example.com' },
    update: {
      balance: 5000,
      bonusBalance: 500,
      totalWinnings: 5000,
      gamesPlayed: 50,
      gamesWon: 25,
    },
    create: {
      name: 'Rajesh Kumar',
      email: 'player@example.com',
      phone: '9876543210',
      password: hashedUserPassword,
      role: 'USER',
      balance: 5000,
      bonusBalance: 500,
      totalWinnings: 5000,
      gamesPlayed: 50,
      gamesWon: 25,
      referralCode: userReferralCode,
      streak: 5
    }
  });
  console.log('✅ Created Regular User:');
  console.log(`   Email: player@example.com`);
  console.log(`   Password: user123`);
  console.log(`   Role: USER`);
  console.log(`   Balance: ₹${user.balance}`);
  console.log(`   Referral Code: ${user.referralCode}\n`);

  // Create sub-admin
  const hashedAdminPassword = await bcrypt.hash('admin123', 12);
  const adminReferralCode = generateReferralCode();
  
  const subAdmin = await prisma.user.upsert({
    where: { email: 'subadmin@indiaplay.com' },
    update: {},
    create: {
      name: 'Vikram Singh',
      email: 'subadmin@indiaplay.com',
      phone: '9876543211',
      password: hashedAdminPassword,
      role: 'SUB_ADMIN',
      balance: 0,
      bonusBalance: 0,
      referralCode: adminReferralCode
    }
  });
  console.log('✅ Created Sub-Admin:');
  console.log(`   Email: subadmin@indiaplay.com`);
  console.log(`   Password: admin123`);
  console.log(`   Role: SUB_ADMIN\n`);

  // Create a Super Admin (for testing full admin access)
  const hashedSuperAdminPassword = await bcrypt.hash('super123', 12);
  const superAdminReferralCode = generateReferralCode();
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@indiaplay.com' },
    update: {},
    create: {
      name: 'Admin Master',
      email: 'superadmin@indiaplay.com',
      phone: '9876543212',
      password: hashedSuperAdminPassword,
      role: 'SUPER_ADMIN',
      balance: 0,
      bonusBalance: 0,
      referralCode: superAdminReferralCode
    }
  });
  console.log('✅ Created Super Admin:');
  console.log(`   Email: superadmin@indiaplay.com`);
  console.log(`   Password: super123`);
  console.log(`   Role: SUPER_ADMIN\n`);

  // Create deposit plans
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
    console.log('✅ Created Deposit Plans\n');
  }

  // Create bonus codes
  const bonusCodeCount = await prisma.bonusCode.count();
  if (bonusCodeCount === 0) {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    await prisma.bonusCode.createMany({
      data: [
        { code: 'WELCOME50', coinAmount: 50, discountPercent: 0, description: 'Welcome bonus - Get 50 free coins!', maxUses: 1, startsAt: now, expiresAt: nextMonth },
        { code: 'PLAY100', coinAmount: 100, discountPercent: 0, description: 'Play and win - 100 free coins!', startsAt: now, expiresAt: nextWeek },
        { code: 'LUCKY200', coinAmount: 200, discountPercent: 0, description: 'Lucky draw - 200 free coins!', startsAt: now, expiresAt: nextWeek },
        { code: 'VIP500', coinAmount: 500, discountPercent: 10, description: 'VIP bonus - 500 coins + 10% extra!', minDeposit: 1000, startsAt: now, expiresAt: nextMonth },
        { code: 'FESTIVE1000', coinAmount: 1000, discountPercent: 20, description: 'Festival special - 1000 coins + 20% extra!', minDeposit: 5000, startsAt: now, expiresAt: nextMonth }
      ]
    });
    console.log('✅ Created Bonus Codes\n');
  }

  // Create games - Only Ludo for now
  const gameCount = await prisma.game.count();
  if (gameCount === 0) {
    await prisma.game.createMany({
      data: [
        { name: 'Ludo', description: 'Classic dice game - Roll dice, move tokens, beat the AI!', category: 'Arcade', minBet: 10, maxBet: 5000, maxWin: 10000, color: '#ec4899', icon: 'Gamepad2', isHot: true, isFeatured: true, players: 500000, image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=400&fit=crop' },
      ]
    });
    console.log('✅ Created Ludo Game');
  }

  console.log('═══════════════════════════════════════════');
  console.log('          SEEDING COMPLETE!');
  console.log('═══════════════════════════════════════════');
  console.log('\nTest Accounts:');
  console.log('───────────────────────────────────────────');
  console.log('USER:      player@example.com / user123');
  console.log('SUB_ADMIN: subadmin@indiaplay.com / admin123');
  console.log('SUPER_ADMIN: superadmin@indiaplay.com / super123');
  console.log('───────────────────────────────────────────');
  console.log('\nBonus Codes: WELCOME50, PLAY100, LUCKY200, VIP500, FESTIVE1000');
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
