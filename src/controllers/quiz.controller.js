import * as quizService from '../services/quiz.service.js';
import { catchAsync } from '../utils/AppError.js';
import { successResponse, paginationMeta } from '../utils/response.js';

export const createQuiz = catchAsync(async (req, res) => {
  const quiz = await quizService.createQuiz(req.body, req.user._id);
  successResponse(res, { message: 'Quiz created', data: { quiz } }, 201);
});

export const getQuizzes = catchAsync(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { quizzes, total } = await quizService.getQuizzes(req.query, isAdmin);
  const meta = paginationMeta(total, req.query.page, req.query.limit);
  successResponse(res, { data: { quizzes } }, 200, meta);
});

export const getQuizById = catchAsync(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const quiz = await quizService.getQuizById(req.params.quizId, isAdmin);
  successResponse(res, { data: { quiz } });
});

export const updateQuiz = catchAsync(async (req, res) => {
  const quiz = await quizService.updateQuiz(req.params.quizId, req.body);
  successResponse(res, { message: 'Quiz updated', data: { quiz } });
});

export const deleteQuiz = catchAsync(async (req, res) => {
  await quizService.deleteQuiz(req.params.quizId);
  successResponse(res, { message: 'Quiz deleted' });
});

export const publishQuiz = catchAsync(async (req, res) => {
  const quiz = await quizService.publishQuiz(req.params.quizId);
  successResponse(res, { message: 'Quiz published', data: { quiz } });
});

export const unpublishQuiz = catchAsync(async (req, res) => {
  const quiz = await quizService.unpublishQuiz(req.params.quizId);
  successResponse(res, { message: 'Quiz unpublished', data: { quiz } });
});

export const getStatistics = catchAsync(async (req, res) => {
  const stats = await quizService.getQuizStatistics();
  successResponse(res, { data: { statistics: stats } });
});
