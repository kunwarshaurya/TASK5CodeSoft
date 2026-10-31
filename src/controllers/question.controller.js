import * as questionService from '../services/question.service.js';
import { catchAsync } from '../utils/AppError.js';
import { successResponse } from '../utils/response.js';

export const createQuestion = catchAsync(async (req, res) => {
  const question = await questionService.createQuestion(req.params.quizId, req.body);
  successResponse(res, { message: 'Question created', data: { question } }, 201);
});

export const getQuestions = catchAsync(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const questions = await questionService.getQuestions(req.params.quizId, isAdmin);
  successResponse(res, { data: { questions } });
});

export const getQuestionById = catchAsync(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const question = await questionService.getQuestionById(req.params.quizId, req.params.questionId, isAdmin);
  successResponse(res, { data: { question } });
});

export const updateQuestion = catchAsync(async (req, res) => {
  const question = await questionService.updateQuestion(req.params.quizId, req.params.questionId, req.body);
  successResponse(res, { message: 'Question updated', data: { question } });
});

export const deleteQuestion = catchAsync(async (req, res) => {
  await questionService.deleteQuestion(req.params.quizId, req.params.questionId);
  successResponse(res, { message: 'Question deleted' });
});
