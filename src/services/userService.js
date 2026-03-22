import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function generateReferralCode() {
  return 'INDIA' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const userService = {
  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  },

  async findByPhone(phone) {
    return prisma.user.findUnique({ where: { phone } });
  },

  async findById(id) {
    return prisma.user.findUnique({ 
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        balance: true,
        bonusBalance: true,
        totalWinnings: true,
        gamesPlayed: true,
        gamesWon: true,
        referralCode: true,
        streak: true,
        createdAt: true
      }
    });
  },

  async findByGoogleId(googleId) {
    return prisma.user.findUnique({ where: { googleId } });
  },

  async findByReferralCode(code) {
    return prisma.user.findUnique({ where: { referralCode: code } });
  },

  async create(data) {
    const hashedPassword = data.password 
      ? await bcrypt.hash(data.password, 12) 
      : null;
    
    let referralCode;
    do {
      referralCode = generateReferralCode();
    } while (await prisma.user.findUnique({ where: { referralCode } }));

    let referredById = null;
    if (data.referralCode) {
      const referrer = await prisma.user.findUnique({ 
        where: { referralCode: data.referralCode } 
      });
      if (referrer) referredById = referrer.id;
    }

    return prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
        referralCode,
        referredBy: referredById
      }
    });
  },

  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data
    });
  },

  async updateBalance(userId, amount, type = 'balance') {
    const field = type === 'bonus' ? 'bonusBalance' : 'balance';
    return prisma.user.update({
      where: { id: userId },
      data: { [field]: { increment: amount } }
    });
  },

  async decrementBalance(userId, amount) {
    return prisma.user.update({
      where: { id: userId },
      data: { balance: { decrement: amount } }
    });
  },

  async updateStats(userId, won = false) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const updates = {
      gamesPlayed: { increment: 1 }
    };
    if (won) {
      updates.gamesWon = { increment: 1 };
    }
    return prisma.user.update({
      where: { id: userId },
      data: updates
    });
  },

  async getAll(page = 1, limit = 20, role = null, search = null) {
    const skip = (page - 1) * limit;
    let where = {};
    
    if (role) {
      where.role = role;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          balance: true,
          bonusBalance: true,
          totalWinnings: true,
          gamesPlayed: true,
          gamesWon: true,
          referralCode: true,
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.user.count({ where })
    ]);

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  },

  async search(query) {
    return prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        balance: true,
        gamesPlayed: true,
        totalWinnings: true
      }
    });
  }
};
