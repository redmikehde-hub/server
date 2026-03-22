import { Router } from 'express';
import { authController } from '../controllers/authController.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login/phone', authController.loginWithPhone);
router.post('/google', authController.googleAuth);
router.post('/refresh', authController.refreshToken);

export default router;
