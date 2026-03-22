import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { broadcastController } from '../controllers/broadcastController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.post('/create-subadmin', authenticate, authorize('SUPER_ADMIN'), adminController.createSubAdmin);
router.get('/stats', authenticate, authorize('SUB_ADMIN', 'SUPER_ADMIN'), adminController.getStats);
router.post('/notify', authenticate, authorize('SUPER_ADMIN'), broadcastController.create);
router.get('/broadcasts', authenticate, authorize('SUPER_ADMIN'), broadcastController.getAll);

export default router;
