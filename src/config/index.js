import dotenv from 'dotenv';
dotenv.config();

const allowedFrontendUrls = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://casinov1demo.netlify.app',
].filter(Boolean);

export default {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  allowedFrontendUrls,
  jwt: {
    secret: process.env.JWT_SECRET || 'default_secret_change_in_production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default_refresh_secret',
    expiresIn: '24h',
    refreshExpiresIn: '7d'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  }
};
