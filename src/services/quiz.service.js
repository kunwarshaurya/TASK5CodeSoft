import mongoose from 'mongoose';
import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import Attempt from '../models/Attempt.js';
import { AppError } from '../utils/AppError.js';

export const createQuiz = async (data, userId) => {
  const quiz = await Quiz.create({ ...data, createdBy: userId });
  return quiz.toJSON();
};

export const getQuizzes = async (query, isAdmin = false) => {
  const { page, limit, search, category, status, sortBy, sortOrder } = query;
  const filter = {};

  // Participants only see published quizzes
  if (!isAdmin) {
    filter.status = 'published';
  } else if (status) {
    filter.status = status;
  }

  if (search) filter.$text = { $search: search };
  if (category) filter.category = category;

  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (page - 1) * limit;

  const [quizzes, total] = await Promise.all([
    Quiz.find(filter).populate('createdBy', 'name').sort(sort).skip(skip).limit(limit).lean(),
    Quiz.countDocuments(filter),
  ]);
  return { quizzes, total };
};

export const getQuizById = async (id, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid quiz ID', 400);

  const quiz = await Quiz.findById(id).populate('createdBy', 'name');
  if (!quiz) throw new AppError('Quiz not found', 404);

  // Participants can only see published quizzes
  if (!isAdmin && quiz.status !== 'published') {
    throw new AppError('Quiz not found', 404);
  }

  return quiz.toJSON();
};

export const updateQuiz = async (id, data) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid quiz ID', 400);

  const quiz = await Quiz.findById(id);
  if (!quiz) throw new AppError('Quiz not found', 404);

  // Don't allow updating a published quiz's critical settings without unpublishing first
  // (optional enforcement — we allow it but warn via docs)
  Object.assign(quiz, data);
  await quiz.save();
  return quiz.toJSON();
};

export const deleteQuiz = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid quiz ID', 400);

  const quiz = await Quiz.findById(id);
  if (!quiz) throw new AppError('Quiz not found', 404);

  // Check for existing attempts
  const attemptCount = await Attempt.countDocuments({ quiz: id });
  if (attemptCount > 0) {
    throw new AppError(
      `Cannot delete quiz — ${attemptCount} attempt(s) exist. Unpublish the quiz instead.`,
      409
    );
  }

  // Delete associated questions
  await Question.deleteMany({ quiz: id });
  await Quiz.findByIdAndDelete(id);
  return true;
};

export const publishQuiz = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid quiz ID', 400);

  const quiz = await Quiz.findById(id);
  if (!quiz) throw new AppError('Quiz not found', 404);

  // Must have at least one question to publish
  const questionCount = await Question.countDocuments({ quiz: id });
  if (questionCount === 0) {
    throw new AppError('Cannot publish a quiz with no questions', 400);
  }

  quiz.status = 'published';
  quiz.totalQuestions = questionCount;

  // Calculate total marks
  const totalMarksAgg = await Question.aggregate([
    { $match: { quiz: quiz._id } },
    { $group: { _id: null, totalMarks: { $sum: '$marks' } } },
  ]);
  quiz.totalMarks = totalMarksAgg[0]?.totalMarks || 0;

  await quiz.save();
  return quiz.toJSON();
};

export const unpublishQuiz = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError('Invalid quiz ID', 400);

  const quiz = await Quiz.findById(id);
  if (!quiz) throw new AppError('Quiz not found', 404);

  quiz.status = 'unpublished';
  await quiz.save();
  return quiz.toJSON();
};

/**
 * Get quiz statistics for admins.
 */
export const getQuizStatistics = async () => {
  const [totalQuizzes, publishedQuizzes, totalAttempts, totalParticipants] = await Promise.all([
    Quiz.countDocuments(),
    Quiz.countDocuments({ status: 'published' }),
    Attempt.countDocuments({ status: 'submitted' }),
    Attempt.distinct('participant', { status: 'submitted' }).then((arr) => arr.length),
  ]);

  // Average score across all submitted attempts
  const avgScoreAgg = await Attempt.aggregate([
    { $match: { status: 'submitted' } },
    { $group: { _id: null, avgPercentage: { $avg: '$percentage' } } },
  ]);

  // Pass rate
  const passedCount = await Attempt.countDocuments({ status: 'submitted', passed: true });

  // Most attempted quizzes
  const mostAttempted = await Attempt.aggregate([
    { $match: { status: 'submitted' } },
    { $group: { _id: '$quiz', attemptCount: { $sum: 1 }, avgScore: { $avg: '$percentage' } } },
    { $sort: { attemptCount: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'quizzes', localField: '_id', foreignField: '_id', as: 'quizInfo' } },
    { $unwind: '$quizInfo' },
    { $project: { _id: 0, quizId: '$_id', title: '$quizInfo.title', attemptCount: 1, avgScore: { $round: ['$avgScore', 2] } } },
  ]);

  return {
    totalQuizzes,
    publishedQuizzes,
    totalAttempts,
    totalParticipants,
    averageScore: avgScoreAgg[0] ? parseFloat(avgScoreAgg[0].avgPercentage.toFixed(2)) : 0,
    passRate: totalAttempts > 0 ? parseFloat(((passedCount / totalAttempts) * 100).toFixed(2)) : 0,
    mostAttempted,
  };
};
