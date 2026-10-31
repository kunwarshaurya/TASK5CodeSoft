import { Router } from 'express';
import * as quizController from '../controllers/quiz.controller.js';
import * as questionController from '../controllers/question.controller.js';
import * as attemptController from '../controllers/attempt.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createQuizSchema, updateQuizSchema, quizQuerySchema } from '../validators/quiz.validator.js';
import { createQuestionSchema, updateQuestionSchema, submitAnswersSchema } from '../validators/question.validator.js';

const router = Router();

router.use(protect);

// Quiz CRUD
router
  .route('/')
  .get(validate(quizQuerySchema, 'query'), quizController.getQuizzes)
  .post(authorize('admin'), validate(createQuizSchema), quizController.createQuiz);

router
  .route('/:quizId')
  .get(quizController.getQuizById)
  .patch(authorize('admin'), validate(updateQuizSchema), quizController.updateQuiz)
  .delete(authorize('admin'), quizController.deleteQuiz);

// Quiz publish/unpublish
router.patch('/:quizId/publish', authorize('admin'), quizController.publishQuiz);
router.patch('/:quizId/unpublish', authorize('admin'), quizController.unpublishQuiz);

// Questions (nested under quiz)
router
  .route('/:quizId/questions')
  .get(questionController.getQuestions)
  .post(authorize('admin'), validate(createQuestionSchema), questionController.createQuestion);

router
  .route('/:quizId/questions/:questionId')
  .get(questionController.getQuestionById)
  .patch(authorize('admin'), validate(updateQuestionSchema), questionController.updateQuestion)
  .delete(authorize('admin'), questionController.deleteQuestion);

// Attempts (nested under quiz)
router.post('/:quizId/attempts', attemptController.startAttempt);
router.get('/:quizId/attempts', authorize('admin'), attemptController.getQuizAttempts);

// Leaderboard
router.get('/:quizId/leaderboard', attemptController.getLeaderboard);

export default router;
