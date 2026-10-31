import { Router } from 'express';
import * as attemptController from '../controllers/attempt.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { submitAnswersSchema } from '../validators/question.validator.js';

const router = Router();

router.use(protect);

// Get attempt details / questions
router.get('/:attemptId', attemptController.getAttemptById);
router.get('/:attemptId/questions', attemptController.getAttemptQuestions);

// Submit answers
router.post('/:attemptId/submit', validate(submitAnswersSchema), attemptController.submitAttempt);

export default router;
