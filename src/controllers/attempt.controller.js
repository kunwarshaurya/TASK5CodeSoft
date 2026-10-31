import * as attemptService from '../services/attempt.service.js';
import { catchAsync } from '../utils/AppError.js';
import { successResponse, paginationMeta } from '../utils/response.js';

export const startAttempt = catchAsync(async (req, res) => {
  const attempt = await attemptService.startAttempt(req.params.quizId, req.user._id);
  successResponse(res, { message: 'Quiz attempt started', data: { attempt } }, 201);
});

export const getAttemptQuestions = catchAsync(async (req, res) => {
  const data = await attemptService.getAttemptQuestions(req.params.attemptId, req.user._id);
  successResponse(res, { data });
});

export const submitAttempt = catchAsync(async (req, res) => {
  const result = await attemptService.submitAttempt(
    req.params.attemptId,
    req.user._id,
    req.body.answers
  );
  successResponse(res, { message: 'Attempt submitted and scored', data: { result } });
});

export const getMyResults = catchAsync(async (req, res) => {
  const { results, total } = await attemptService.getMyResults(req.user._id, req.query);
  const meta = paginationMeta(total, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 10);
  successResponse(res, { data: { results } }, 200, meta);
});

export const getAttemptById = catchAsync(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const attempt = await attemptService.getAttemptById(req.params.attemptId, req.user._id, isAdmin);
  successResponse(res, { data: { attempt } });
});

export const getLeaderboard = catchAsync(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const leaderboard = await attemptService.getLeaderboard(req.params.quizId, limit);
  successResponse(res, { data: { leaderboard } });
});

export const getQuizAttempts = catchAsync(async (req, res) => {
  const { attempts, total } = await attemptService.getQuizAttempts(req.params.quizId, req.query);
  const meta = paginationMeta(total, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 10);
  successResponse(res, { data: { attempts } }, 200, meta);
});
