import { Router } from 'express';
import * as quizController from '../controllers/quiz.controller.js';
import { protect, authorize } from '../middleware/auth.js';

const router = Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/statistics', quizController.getStatistics);

export default router;
