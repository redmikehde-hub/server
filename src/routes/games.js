import { Router } from 'express';
import { gameController } from '../controllers/gameController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', gameController.getAll);
router.get('/categories', gameController.getCategories);
router.get('/featured', gameController.getFeatured);
router.get('/:id', gameController.getById);

// Admin routes
router.post('/', authenticate, authorize('SUPER_ADMIN'), gameController.create);
router.put('/:id', authenticate, authorize('SUPER_ADMIN'), gameController.update);

export default router;
