import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import config from '../config/index.js';
import { userService } from '../services/userService.js';
import { generateTokens } from '../utils/jwt.js';

const googleClient = new OAuth2Client(config.google.clientId);

export const authController = {
  async register(req, res) {
    try {
      const { name, email, phone, password, referralCode } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email and password are required.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }

      const existingEmail = await userService.findByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email already registered.' });
      }

      if (phone) {
        const existingPhone = await userService.findByPhone(phone);
        if (existingPhone) {
          return res.status(400).json({ error: 'Phone already registered.' });
        }
      }

      let referredById = null;
      let referralBonusApplied = false;
      
      if (referralCode) {
        const referrer = await userService.findByReferralCode(referralCode);
        if (referrer && referrer.role === 'USER') {
          referredById = referrer.id;
        }
      }

      const user = await userService.create({ 
        name, 
        email, 
        phone, 
        password,
        referralCode: referralCode || undefined
      });

      if (referredById) {
        try {
          const { referralService } = await import('../services/referralService.js');
          await referralService.applyReferralBonus(referredById, user.id);
          referralBonusApplied = true;
        } catch (err) {
          console.error('Failed to apply referral bonus:', err);
        }
      }

      const { accessToken, refreshToken } = generateTokens(user);

      res.status(201).json({
        message: 'Registration successful.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          balance: user.balance,
          bonusBalance: user.bonusBalance,
          referralCode: user.referralCode
        },
        accessToken,
        refreshToken,
        referralBonusApplied
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed.' });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const user = await userService.findByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const { accessToken, refreshToken } = generateTokens(user);

      res.json({
        message: 'Login successful.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          balance: user.balance,
          bonusBalance: user.bonusBalance,
          totalWinnings: user.totalWinnings,
          gamesPlayed: user.gamesPlayed,
          gamesWon: user.gamesWon,
          referralCode: user.referralCode
        },
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed.' });
    }
  },

  async loginWithPhone(req, res) {
    try {
      const { phone, password } = req.body;

      if (!phone || !password) {
        return res.status(400).json({ error: 'Phone and password are required.' });
      }

      const user = await userService.findByPhone(phone);
      if (!user || !user.password) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const { accessToken, refreshToken } = generateTokens(user);

      res.json({
        message: 'Login successful.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          balance: user.balance,
          bonusBalance: user.bonusBalance
        },
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Phone login error:', error);
      res.status(500).json({ error: 'Login failed.' });
    }
  },

  async googleAuth(req, res) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({ error: 'ID token is required.' });
      }

      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken,
          audience: config.google.clientId
        });
        payload = ticket.getPayload();
      } catch {
        return res.status(401).json({ error: 'Invalid Google token.' });
      }

      const { email, name, sub: googleId } = payload;

      let user = await userService.findByGoogleId(googleId);

      if (!user) {
        user = await userService.findByEmail(email);
        if (user) {
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId }
          });
        } else {
          user = await userService.create({ 
            name: name || email.split('@')[0], 
            email, 
            googleId 
          });
        }
      }

      const { accessToken, refreshToken } = generateTokens(user);

      res.json({
        message: 'Google authentication successful.',
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          balance: user.balance,
          bonusBalance: user.bonusBalance,
          referralCode: user.referralCode
        },
        accessToken,
        refreshToken
      });
    } catch (error) {
      console.error('Google auth error:', error);
      res.status(500).json({ error: 'Google authentication failed.' });
    }
  },

  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required.' });
      }

      const { verifyRefreshToken } = await import('../utils/jwt.js');
      const decoded = verifyRefreshToken(refreshToken);

      const user = await userService.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ error: 'User not found.' });
      }

      const tokens = generateTokens(user);

      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid refresh token.' });
    }
  }
};

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
