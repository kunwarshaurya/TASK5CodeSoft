import mongoose from 'mongoose';
import Attempt from '../models/Attempt.js';
import Quiz from '../models/Quiz.js';
import Question from '../models/Question.js';
import { AppError } from '../utils/AppError.js';

/**
 * Fisher-Yates shuffle for arrays.
 */
const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Start a new quiz attempt for a participant.
 */
export const startAttempt = async (quizId, participantId) => {
  if (!mongoose.Types.ObjectId.isValid(quizId)) throw new AppError('Invalid quiz ID', 400);

  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new AppError('Quiz not found', 404);
  if (quiz.status !== 'published') throw new AppError('Quiz is not available', 400);

  // Check attempt limit
  const previousAttempts = await Attempt.countDocuments({
    quiz: quizId,
    participant: participantId,
    status: { $in: ['submitted', 'expired'] },
  });
  if (previousAttempts >= quiz.maxAttempts) {
    throw new AppError(
      `Maximum attempts (${quiz.maxAttempts}) reached for this quiz`,
      400
    );
  }

  // Check for existing in-progress attempt
  const existingInProgress = await Attempt.findOne({
    quiz: quizId,
    participant: participantId,
    status: 'in-progress',
  });
  if (existingInProgress) {
    // Check if it has expired
    if (new Date() > existingInProgress.expiresAt) {
      existingInProgress.status = 'expired';
      await existingInProgress.save();
    } else {
      // Return the existing attempt (idempotent restart)
      return existingInProgress.toJSON();
    }
  }

  // Get questions for this quiz
  let questions = await Question.find({ quiz: quizId }).sort({ order: 1 });
  if (questions.length === 0) {
    throw new AppError('Quiz has no questions', 400);
  }

  // Shuffle questions if enabled
  let questionOrder = questions.map((q) => q._id);
  if (quiz.shuffleQuestions) {
    questionOrder = shuffleArray(questionOrder);
  }

  // Calculate expiry
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + quiz.timeLimitMinutes * 60 * 1000);

  const attempt = await Attempt.create({
    quiz: quizId,
    participant: participantId,
    status: 'in-progress',
    startedAt,
    expiresAt,
    questionOrder,
    totalMarks: quiz.totalMarks,
  });

  return attempt.toJSON();
};

/**
 * Get questions for an active attempt — NEVER includes correct answers.
 */
export const getAttemptQuestions = async (attemptId, participantId) => {
  if (!mongoose.Types.ObjectId.isValid(attemptId)) throw new AppError('Invalid attempt ID', 400);

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) throw new AppError('Attempt not found', 404);

  // Ownership check
  if (attempt.participant.toString() !== participantId.toString()) {
    throw new AppError('You do not have access to this attempt', 403);
  }

  // Check if expired
  if (attempt.status === 'in-progress' && new Date() > attempt.expiresAt) {
    attempt.status = 'expired';
    await attempt.save();
  }

  if (attempt.status !== 'in-progress') {
    throw new AppError(`This attempt is ${attempt.status}`, 400);
  }

  // Fetch questions in the attempt's order
  const questions = await Question.find({ _id: { $in: attempt.questionOrder } });
  const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

  // Return in the shuffled order, with answers stripped
  const quiz = await Quiz.findById(attempt.quiz);
  const orderedQuestions = attempt.questionOrder.map((qId) => {
    const q = questionMap.get(qId.toString());
    if (!q) return null;

    const participantQ = q.toParticipantJSON();

    // Shuffle options if quiz setting enabled
    if (quiz && quiz.shuffleOptions) {
      participantQ.options = shuffleArray(participantQ.options);
    }

    return participantQ;
  }).filter(Boolean);

  return {
    attemptId: attempt._id,
    quizId: attempt.quiz,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    totalQuestions: orderedQuestions.length,
    questions: orderedQuestions,
  };
};

/**
 * Submit answers for an attempt. Calculates score server-side.
 *
 * Idempotency: If the attempt is already submitted, returns the existing result.
 * This prevents duplicate scoring from network retries.
 */
export const submitAttempt = async (attemptId, participantId, submittedAnswers) => {
  if (!mongoose.Types.ObjectId.isValid(attemptId)) throw new AppError('Invalid attempt ID', 400);

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) throw new AppError('Attempt not found', 404);

  // Ownership check
  if (attempt.participant.toString() !== participantId.toString()) {
    throw new AppError('You do not have access to this attempt', 403);
  }

  // Idempotency — return existing result if already submitted
  if (attempt.status === 'submitted') {
    return attempt.toJSON();
  }

  // Check expiry — allow submission of expired attempts (server records it as expired with partial scoring)
  if (attempt.status === 'expired') {
    throw new AppError('This attempt has expired and cannot be submitted', 400);
  }

  // Check timer — mark as expired if past deadline
  const now = new Date();
  if (now > attempt.expiresAt) {
    attempt.status = 'expired';
    await attempt.save();
    throw new AppError('Time limit exceeded — attempt has expired', 400);
  }

  if (attempt.status !== 'in-progress') {
    throw new AppError(`Cannot submit — attempt is ${attempt.status}`, 400);
  }

  // Get quiz settings
  const quiz = await Quiz.findById(attempt.quiz);
  if (!quiz) throw new AppError('Quiz not found', 404);

  // Get all questions for this quiz
  const questions = await Question.find({ _id: { $in: attempt.questionOrder } });
  const questionMap = new Map(questions.map((q) => [q._id.toString(), q]));

  // Validate and score answers
  let correctCount = 0;
  let wrongCount = 0;
  let unansweredCount = 0;
  let scoredMarks = 0;

  const answers = [];

  for (const qId of attempt.questionOrder) {
    const question = questionMap.get(qId.toString());
    if (!question) continue;

    const submitted = submittedAnswers.find(
      (a) => a.questionId === qId.toString()
    );

    const selectedOptionId = submitted?.selectedOptionId || null;

    if (!selectedOptionId) {
      // Unanswered
      unansweredCount++;
      answers.push({
        question: qId,
        selectedOption: null,
        isCorrect: false,
        marksAwarded: 0,
      });
      continue;
    }

    // Validate the selected option belongs to this question
    const selectedOption = question.options.find(
      (opt) => opt._id.toString() === selectedOptionId
    );
    if (!selectedOption) {
      throw new AppError(
        `Invalid option ${selectedOptionId} for question ${qId}`,
        400
      );
    }

    if (selectedOption.isCorrect) {
      correctCount++;
      scoredMarks += question.marks;
      answers.push({
        question: qId,
        selectedOption: selectedOption._id,
        isCorrect: true,
        marksAwarded: question.marks,
      });
    } else {
      wrongCount++;
      let penalty = 0;
      if (quiz.negativeMarking) {
        penalty = parseFloat((question.marks * quiz.negativeMarkingPenalty).toFixed(2));
        scoredMarks -= penalty;
      }
      answers.push({
        question: qId,
        selectedOption: selectedOption._id,
        isCorrect: false,
        marksAwarded: quiz.negativeMarking ? -penalty : 0,
      });
    }
  }

  // Floor scored marks at 0
  scoredMarks = Math.max(0, parseFloat(scoredMarks.toFixed(2)));

  const percentage =
    attempt.totalMarks > 0
      ? parseFloat(((scoredMarks / attempt.totalMarks) * 100).toFixed(2))
      : 0;

  const passed = percentage >= quiz.passingScore;
  const certificateEligible = passed;

  // Update attempt
  attempt.answers = answers;
  attempt.scoredMarks = scoredMarks;
  attempt.percentage = percentage;
  attempt.correctCount = correctCount;
  attempt.wrongCount = wrongCount;
  attempt.unansweredCount = unansweredCount;
  attempt.passed = passed;
  attempt.certificateEligible = certificateEligible;
  attempt.status = 'submitted';
  attempt.submittedAt = now;

  await attempt.save();

  return attempt.toJSON();
};

/**
 * Get participant's own results.
 */
export const getMyResults = async (participantId, query = {}) => {
  const { page = 1, limit = 10 } = query;
  const filter = { participant: participantId, status: 'submitted' };
  const skip = (page - 1) * limit;

  const [results, total] = await Promise.all([
    Attempt.find(filter)
      .populate('quiz', 'title category totalQuestions totalMarks passingScore')
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attempt.countDocuments(filter),
  ]);

  return { results, total };
};

/**
 * Get a single attempt/result by ID.
 */
export const getAttemptById = async (attemptId, userId, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(attemptId)) throw new AppError('Invalid attempt ID', 400);

  const attempt = await Attempt.findById(attemptId)
    .populate('quiz', 'title category totalQuestions totalMarks passingScore negativeMarking negativeMarkingPenalty')
    .populate('participant', 'name email');

  if (!attempt) throw new AppError('Attempt not found', 404);

  // Ownership check for participants
  if (!isAdmin && attempt.participant._id.toString() !== userId.toString()) {
    throw new AppError('You do not have access to this attempt', 403);
  }

  return attempt.toJSON();
};

/**
 * Get quiz leaderboard — top scorers.
 */
export const getLeaderboard = async (quizId, limit = 10) => {
  if (!mongoose.Types.ObjectId.isValid(quizId)) throw new AppError('Invalid quiz ID', 400);

  const quiz = await Quiz.findById(quizId);
  if (!quiz) throw new AppError('Quiz not found', 404);
  if (quiz.status !== 'published') throw new AppError('Quiz is not available', 400);

  const leaderboard = await Attempt.find({
    quiz: quizId,
    status: 'submitted',
  })
    .populate('participant', 'name')
    .sort({ percentage: -1, submittedAt: 1 }) // Higher score first, earlier submission breaks ties
    .limit(limit)
    .select('participant percentage scoredMarks totalMarks correctCount wrongCount submittedAt passed')
    .lean();

  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    participant: entry.participant?.name || 'Unknown',
    percentage: entry.percentage,
    scoredMarks: entry.scoredMarks,
    totalMarks: entry.totalMarks,
    correctCount: entry.correctCount,
    wrongCount: entry.wrongCount,
    passed: entry.passed,
    submittedAt: entry.submittedAt,
  }));
};

/**
 * Get all attempts for a quiz (admin).
 */
export const getQuizAttempts = async (quizId, query = {}) => {
  if (!mongoose.Types.ObjectId.isValid(quizId)) throw new AppError('Invalid quiz ID', 400);

  const { page = 1, limit = 10 } = query;
  const filter = { quiz: quizId };
  const skip = (page - 1) * limit;

  const [attempts, total] = await Promise.all([
    Attempt.find(filter)
      .populate('participant', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attempt.countDocuments(filter),
  ]);

  return { attempts, total };
};
