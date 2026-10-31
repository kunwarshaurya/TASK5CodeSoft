import mongoose from 'mongoose';
import Question from '../models/Question.js';
import Quiz from '../models/Quiz.js';
import { AppError } from '../utils/AppError.js';

export const createQuestion = async (quizId, data) => {
  if (!mongoose.Types.ObjectId.isValid(quizId)) throw new AppError('Invalid quiz ID', 400);

  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new AppError('Quiz not found', 404);

  const question = await Question.create({ ...data, quiz: quizId });

  // Update quiz question count and total marks
  const stats = await Question.aggregate([
    { $match: { quiz: quiz._id } },
    { $group: { _id: null, count: { $sum: 1 }, totalMarks: { $sum: '$marks' } } },
  ]);
  quiz.totalQuestions = stats[0]?.count || 0;
  quiz.totalMarks = stats[0]?.totalMarks || 0;
  await quiz.save();

  return question.toAdminJSON();
};

export const getQuestions = async (quizId, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(quizId)) throw new AppError('Invalid quiz ID', 400);

  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new AppError('Quiz not found', 404);

  const questions = await Question.find({ quiz: quizId }).sort({ order: 1 });

  if (isAdmin) {
    return questions.map((q) => q.toAdminJSON());
  }

  // SECURITY: Participants never see correct answers through this endpoint
  return questions.map((q) => q.toParticipantJSON());
};

export const getQuestionById = async (quizId, questionId, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(quizId)) throw new AppError('Invalid quiz ID', 400);
  if (!mongoose.Types.ObjectId.isValid(questionId)) throw new AppError('Invalid question ID', 400);

  const question = await Question.findOne({ _id: questionId, quiz: quizId });
  if (!question) throw new AppError('Question not found', 404);

  return isAdmin ? question.toAdminJSON() : question.toParticipantJSON();
};

export const updateQuestion = async (quizId, questionId, data) => {
  if (!mongoose.Types.ObjectId.isValid(quizId)) throw new AppError('Invalid quiz ID', 400);
  if (!mongoose.Types.ObjectId.isValid(questionId)) throw new AppError('Invalid question ID', 400);

  const question = await Question.findOne({ _id: questionId, quiz: quizId });
  if (!question) throw new AppError('Question not found', 404);

  Object.assign(question, data);
  await question.save();

  // Update quiz total marks
  const quiz = await Quiz.findById(quizId);
  if (quiz) {
    const stats = await Question.aggregate([
      { $match: { quiz: quiz._id } },
      { $group: { _id: null, totalMarks: { $sum: '$marks' } } },
    ]);
    quiz.totalMarks = stats[0]?.totalMarks || 0;
    await quiz.save();
  }

  return question.toAdminJSON();
};

export const deleteQuestion = async (quizId, questionId) => {
  if (!mongoose.Types.ObjectId.isValid(quizId)) throw new AppError('Invalid quiz ID', 400);
  if (!mongoose.Types.ObjectId.isValid(questionId)) throw new AppError('Invalid question ID', 400);

  const question = await Question.findOneAndDelete({ _id: questionId, quiz: quizId });
  if (!question) throw new AppError('Question not found', 404);

  // Update quiz stats
  const quiz = await Quiz.findById(quizId);
  if (quiz) {
    const stats = await Question.aggregate([
      { $match: { quiz: quiz._id } },
      { $group: { _id: null, count: { $sum: 1 }, totalMarks: { $sum: '$marks' } } },
    ]);
    quiz.totalQuestions = stats[0]?.count || 0;
    quiz.totalMarks = stats[0]?.totalMarks || 0;
    await quiz.save();
  }

  return true;
};
