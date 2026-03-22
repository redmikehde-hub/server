import { Router } from 'express';
import { withdrawController } from '../controllers/withdrawController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.post('/request', authenticate, withdrawController.request);
router.get('/my-requests', authenticate, withdrawController.getMyRequests);
router.get('/all', authenticate, authorize('SUB_ADMIN', 'SUPER_ADMIN'), withdrawController.getAll);
router.patch('/:id', authenticate, authorize('SUB_ADMIN', 'SUPER_ADMIN'), withdrawController.updateStatus);

export default router;
