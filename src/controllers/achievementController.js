import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultAchievements = [
  { name: 'First Win', description: 'Win your first game', icon: 'Star', type: 'GAMES_WON', target: 1, reward: 100, rarity: 'Common', color: '#6b7280' },
  { name: 'Getting Started', description: 'Play 10 games', icon: 'Target', type: 'GAMES_PLAYED', target: 10, reward: 50, rarity: 'Common', color: '#6b7280' },
  { name: 'Matka Master', description: 'Win 10 Matka games', icon: 'Flame', type: 'GAMES_WON', target: 10, reward: 500, rarity: 'Rare', color: '#3b82f6' },
  { name: 'High Roller', description: 'Bet ₹10,000 in one day', icon: 'Trophy', type: 'GAMES_PLAYED', target: 20, reward: 1000, rarity: 'Epic', color: '#a855f7' },
  { name: 'Lucky Seven', description: 'Win 7 consecutive games', icon: 'Star', type: 'STREAK', target: 7, reward: 750, rarity: 'Epic', color: '#a855f7' },
  { name: 'Big Winner', description: 'Win ₹1,00,000+ in single game', icon: 'Trophy', type: 'SINGLE_WIN', target: 100000, reward: 5000, rarity: 'Legendary', color: '#f97316' },
  { name: 'Dedicated Player', description: 'Play for 7 days straight', icon: 'Crown', type: 'DAILY_LOGIN', target: 7, reward: 1000, rarity: 'Rare', color: '#3b82f6' },
  { name: 'Generous', description: 'Refer 5 friends', icon: 'Gift', type: 'REFERRAL', target: 5, reward: 500, rarity: 'Common', color: '#6b7280' },
];

async function seedAchievements() {
  try {
    for (const ach of defaultAchievements) {
      await prisma.achievement.upsert({
        where: { name: ach.name },
        update: {},
        create: ach
      });
    }
    console.log('Achievements seeded successfully');
  } catch (error) {
    console.error('Failed to seed achievements:', error.message);
  }
}

seedAchievements();

export const achievementController = {
  async getAll(req, res) {
    try {
      const achievements = await prisma.achievement.findMany({
        orderBy: { rarity: 'asc' }
      });

      let userAchievements = [];
      if (req.user) {
        userAchievements = await prisma.userAchievement.findMany({
          where: { userId: req.user.id }
        });
      }

      const achievementsWithProgress = achievements.map(ach => {
        const userAch = userAchievements.find(ua => ua.achievementId === ach.id);
        return {
          ...ach,
          progress: userAch?.progress || 0,
          isUnlocked: userAch?.isUnlocked || false,
          unlockedAt: userAch?.unlockedAt,
          rewardClaimed: userAch?.rewardClaimed || false
        };
      });

      res.json({ achievements: achievementsWithProgress });
    } catch (error) {
      console.error('Get achievements error:', error);
      res.status(500).json({ error: 'Failed to fetch achievements.' });
    }
  },

  async getMyAchievements(req, res) {
    try {
      const userAchievements = await prisma.userAchievement.findMany({
        where: { userId: req.user.id },
        include: { achievement: true }
      });

      res.json({ achievements: userAchievements });
    } catch (error) {
      console.error('Get my achievements error:', error);
      res.status(500).json({ error: 'Failed to fetch achievements.' });
    }
  },

  async updateProgress(req, res) {
    try {
      const { type, value } = req.body;

      const achievements = await prisma.achievement.findMany({
        where: { type, isActive: undefined }
      });

      const updates = [];
      for (const ach of achievements) {
        const userAch = await prisma.userAchievement.findUnique({
          where: {
            userId_achievementId: {
              userId: req.user.id,
              achievementId: ach.id
            }
          }
        });

        if (!userAch || !userAch.isUnlocked) {
          const newProgress = (userAch?.progress || 0) + value;
          const isUnlocked = newProgress >= ach.target;

          if (userAch) {
            await prisma.userAchievement.update({
              where: { id: userAch.id },
              data: { 
                progress: newProgress,
                isUnlocked,
                unlockedAt: isUnlocked && !userAch.isUnlocked ? new Date() : undefined
              }
            });
          } else {
            await prisma.userAchievement.create({
              data: {
                userId: req.user.id,
                achievementId: ach.id,
                progress: newProgress,
                isUnlocked,
                unlockedAt: isUnlocked ? new Date() : null
              }
            });
          }

          if (isUnlocked && (!userAch || !userAch.isUnlocked)) {
            updates.push(ach);
          }
        }
      }

      res.json({ message: 'Progress updated.', unlocked: updates });
    } catch (error) {
      console.error('Update progress error:', error);
      res.status(500).json({ error: 'Failed to update progress.' });
    }
  },

  async claimReward(req, res) {
    try {
      const { achievementId } = req.params;

      const userAch = await prisma.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId: req.user.id,
            achievementId
          }
        },
        include: { achievement: true }
      });

      if (!userAch) {
        return res.status(404).json({ error: 'Achievement not found.' });
      }

      if (!userAch.isUnlocked) {
        return res.status(400).json({ error: 'Achievement not unlocked.' });
      }

      if (userAch.rewardClaimed) {
        return res.status(400).json({ error: 'Reward already claimed.' });
      }

      await prisma.user.update({
        where: { id: req.user.id },
        data: { bonusBalance: { increment: userAch.achievement.reward } }
      });

      await prisma.userAchievement.update({
        where: { id: userAch.id },
        data: { rewardClaimed: true }
      });

      res.json({ 
        message: 'Reward claimed!',
        reward: userAch.achievement.reward 
      });
    } catch (error) {
      console.error('Claim reward error:', error);
      res.status(500).json({ error: 'Failed to claim reward.' });
    }
  }
};
