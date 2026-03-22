# IndiaPlay Backend

## Quick Start

```bash
cd server
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## Default Admin
- **Email:** admin@indiaplay.com
- **Password:** SuperAdmin@123

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (name, email, phone, password) |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/login/phone` | Login with phone/password |
| POST | `/api/auth/google` | Google OAuth |
| POST | `/api/auth/refresh` | Refresh tokens |

### User
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/user/me` | Get current user | Required |
| PUT | `/api/user/me` | Update profile | Required |
| PUT | `/api/user/password` | Change password | Required |
| GET | `/api/user/search?q=` | Search users | Required |
| GET | `/api/user/all` | Get all users | Admin |

### Wallet
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/wallet` | Get balance | Required |
| POST | `/api/wallet/deposit` | Deposit (with bonus code) | Required |
| POST | `/api/wallet/transfer` | Bonus to main wallet | Required |
| GET | `/api/wallet/transactions` | Get transactions | Required |
| POST | `/api/wallet/add` | Add balance (admin) | Admin |

### Withdraw
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/withdraw/request` | Submit request | Required |
| GET | `/api/withdraw/my-requests` | My requests | Required |
| GET | `/api/withdraw/all` | All requests | Admin |
| PATCH | `/api/withdraw/:id` | Approve/Reject | Admin |

### Games
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/games` | Get all games | Public |
| GET | `/api/games/featured` | Featured games | Public |
| GET | `/api/games/categories` | Game categories | Public |
| GET | `/api/games/:id` | Game details | Public |
| POST | `/api/games` | Create game | Admin |

### Leaderboard
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/leaderboard/monthly` | Monthly top 50 | Public |
| GET | `/api/leaderboard/top` | Top players | Public |
| GET | `/api/leaderboard/rank/me` | My rank | Required |

### Achievements
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/achievements` | All achievements | Required |
| GET | `/api/achievements/my` | My achievements | Required |
| POST | `/api/achievements/progress` | Update progress | Required |
| POST | `/api/achievements/:id/claim` | Claim reward | Required |

### Bonuses
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/bonuses` | All bonuses | Required |
| GET | `/api/bonuses/my` | My bonus claims | Required |
| POST | `/api/bonuses/validate` | Validate code | Required |
| POST | `/api/bonuses/claim` | Claim bonus | Required |
| GET | `/api/bonuses/referral` | Referral stats | Required |

### Notifications
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/notifications` | All notifications | Required |
| GET | `/api/notifications/unread-count` | Unread count | Required |
| PATCH | `/api/notifications/:id/read` | Mark as read | Required |
| PATCH | `/api/notifications/read-all` | Mark all read | Required |
| DELETE | `/api/notifications/:id` | Delete | Required |

### Admin
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/admin/create-subadmin` | Create sub-admin | Super Admin |
| GET | `/api/admin/stats` | Dashboard stats | Admin |

---

## Database Models

- **User** - id, name, email, phone, password, role, balance, bonusBalance, totalWinnings, gamesPlayed, gamesWon, referralCode
- **Transaction** - id, userId, type, amount, remark, gameId
- **WithdrawRequest** - id, userId, amount, status, remark
- **Game** - id, name, description, category, minBet, maxBet, maxWin, color, icon, isHot, isFeatured
- **Achievement** - id, name, description, icon, type, target, reward, rarity
- **UserAchievement** - id, userId, achievementId, progress, isUnlocked
- **Bonus** - id, code, type, title, percentage, reward, minDeposit, maxBonus
- **BonusClaim** - id, userId, bonusId, status, amount
- **Notification** - id, userId, type, title, message, isRead

---

## Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```
