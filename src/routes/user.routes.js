import { Router } from 'express';
import * as attemptController from '../controllers/attempt.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.use(protect);

router.get('/results', attemptController.getMyResults);

export default router;
