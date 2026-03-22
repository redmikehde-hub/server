import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/me', authenticate, userController.getMe);
router.put('/me', authenticate, userController.updateProfile);
router.put('/password', authenticate, userController.changePassword);
router.get('/search', authenticate, userController.search);
router.get('/all', authenticate, authorize('SUB_ADMIN', 'SUPER_ADMIN'), userController.getAll);
router.get('/:id', authenticate, userController.getById);

export default router;
