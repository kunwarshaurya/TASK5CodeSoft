import { jest } from '@jest/globals';
import request from 'supertest';
import { connectTestDB, clearTestDB, closeTestDB } from './setup.js';

process.env.JWT_SECRET = 'test-secret';
process.env.MONGODB_URI = 'mongodb://localhost/test';
process.env.NODE_ENV = 'test';

let app;

beforeAll(async () => {
  await connectTestDB();
  const mod = await import('../src/app.js');
  app = mod.default;
});

afterEach(async () => { await clearTestDB(); });
afterAll(async () => { await closeTestDB(); });

// ─── Helpers ───
const createAdmin = async () => {
  const User = (await import('../src/models/User.js')).default;
  await User.create({ name: 'Admin', email: 'admin@test.com', password: 'admin123', role: 'admin' });
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
  return res.body.data.token;
};

const createParticipant = async (email = 'participant@test.com') => {
  const res = await request(app).post('/api/v1/auth/register').send({
    name: 'Participant', email, password: 'pass123',
  });
  return { token: res.body.data.token, userId: res.body.data.user._id };
};

const createQuizWithQuestions = async (adminToken) => {
  // Create quiz
  const quizRes = await request(app).post('/api/v1/quizzes')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ title: 'Test Quiz', timeLimitMinutes: 30, passingScore: 50, negativeMarking: true, negativeMarkingPenalty: 0.25, maxAttempts: 2 });
  const quizId = quizRes.body.data.quiz._id;

  // Add 2 questions
  const q1Res = await request(app).post(`/api/v1/quizzes/${quizId}/questions`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      text: 'What is 2+2?',
      options: [
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
        { text: '5', isCorrect: false },
      ],
      marks: 2,
    });

  const q2Res = await request(app).post(`/api/v1/quizzes/${quizId}/questions`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      text: 'Capital of France?',
      options: [
        { text: 'London', isCorrect: false },
        { text: 'Paris', isCorrect: true },
        { text: 'Berlin', isCorrect: false },
      ],
      marks: 2,
    });

  // Publish
  await request(app).patch(`/api/v1/quizzes/${quizId}/publish`)
    .set('Authorization', `Bearer ${adminToken}`);

  return {
    quizId,
    q1Id: q1Res.body.data.question._id,
    q2Id: q2Res.body.data.question._id,
    q1CorrectOptionId: q1Res.body.data.question.options.find((o) => o.isCorrect)._id,
    q2CorrectOptionId: q2Res.body.data.question.options.find((o) => o.isCorrect)._id,
    q1WrongOptionId: q1Res.body.data.question.options.find((o) => !o.isCorrect)._id,
    q2WrongOptionId: q2Res.body.data.question.options.find((o) => !o.isCorrect)._id,
  };
};

// ═══════════════════════════════════════════════════════════
// AUTH TESTS
// ═══════════════════════════════════════════════════════════
describe('Auth', () => {
  it('should register a participant', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice', email: 'alice@test.com', password: 'password123',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('participant');
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('should not allow role escalation', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Hacker', email: 'hack@test.com', password: 'password123', role: 'admin',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('participant');
  });

  it('should login', async () => {
    await createParticipant('login@test.com');
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'login@test.com', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════
// AUTHORIZATION TESTS
// ═══════════════════════════════════════════════════════════
describe('Authorization', () => {
  it('should reject participant from creating quiz', async () => {
    const { token } = await createParticipant();
    const res = await request(app).post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hack Quiz' });
    expect(res.status).toBe(403);
  });

  it('should reject participant from admin statistics', async () => {
    const { token } = await createParticipant();
    const res = await request(app).get('/api/v1/admin/statistics')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════
// QUIZ MANAGEMENT
// ═══════════════════════════════════════════════════════════
describe('Quiz Management', () => {
  let adminToken;
  beforeEach(async () => { adminToken = await createAdmin(); });

  it('should create a quiz', async () => {
    const res = await request(app).post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Science Quiz', category: 'Science', timeLimitMinutes: 15 });
    expect(res.status).toBe(201);
    expect(res.body.data.quiz.status).toBe('draft');
  });

  it('should not publish quiz without questions', async () => {
    const quizRes = await request(app).post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Empty Quiz' });
    const res = await request(app).patch(`/api/v1/quizzes/${quizRes.body.data.quiz._id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('should publish quiz with questions', async () => {
    const { quizId } = await createQuizWithQuestions(adminToken);
    const res = await request(app).get(`/api/v1/quizzes/${quizId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.quiz.status).toBe('published');
    expect(res.body.data.quiz.totalQuestions).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════
// ANSWER SECURITY — CRITICAL
// ═══════════════════════════════════════════════════════════
describe('Answer Security', () => {
  let adminToken, participantToken, quizId;

  beforeEach(async () => {
    adminToken = await createAdmin();
    const p = await createParticipant();
    participantToken = p.token;
    const quiz = await createQuizWithQuestions(adminToken);
    quizId = quiz.quizId;
  });

  it('participant should NOT see isCorrect in question list', async () => {
    const res = await request(app).get(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${participantToken}`);
    expect(res.status).toBe(200);
    for (const q of res.body.data.questions) {
      for (const opt of q.options) {
        expect(opt.isCorrect).toBeUndefined();
      }
      expect(q.explanation).toBeUndefined();
    }
  });

  it('admin SHOULD see isCorrect in question list', async () => {
    const res = await request(app).get(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const hasCorrect = res.body.data.questions.some((q) =>
      q.options.some((o) => o.isCorrect !== undefined)
    );
    expect(hasCorrect).toBe(true);
  });

  it('participant should NOT see isCorrect in attempt questions', async () => {
    // Start attempt
    const attemptRes = await request(app).post(`/api/v1/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    const attemptId = attemptRes.body.data.attempt._id;

    const res = await request(app).get(`/api/v1/attempts/${attemptId}/questions`)
      .set('Authorization', `Bearer ${participantToken}`);
    expect(res.status).toBe(200);
    for (const q of res.body.data.questions) {
      for (const opt of q.options) {
        expect(opt.isCorrect).toBeUndefined();
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════
// QUIZ ATTEMPT & SCORING
// ═══════════════════════════════════════════════════════════
describe('Quiz Attempts & Scoring', () => {
  let adminToken, participantToken, quizData;

  beforeEach(async () => {
    adminToken = await createAdmin();
    const p = await createParticipant();
    participantToken = p.token;
    quizData = await createQuizWithQuestions(adminToken);
  });

  it('should start an attempt', async () => {
    const res = await request(app).post(`/api/v1/quizzes/${quizData.quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    expect(res.status).toBe(201);
    expect(res.body.data.attempt.status).toBe('in-progress');
    expect(res.body.data.attempt.expiresAt).toBeDefined();
  });

  it('should calculate score correctly — all correct', async () => {
    const attemptRes = await request(app).post(`/api/v1/quizzes/${quizData.quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    const attemptId = attemptRes.body.data.attempt._id;

    const res = await request(app).post(`/api/v1/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({
        answers: [
          { questionId: quizData.q1Id, selectedOptionId: quizData.q1CorrectOptionId },
          { questionId: quizData.q2Id, selectedOptionId: quizData.q2CorrectOptionId },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.result.scoredMarks).toBe(4);
    expect(res.body.data.result.percentage).toBe(100);
    expect(res.body.data.result.passed).toBe(true);
    expect(res.body.data.result.correctCount).toBe(2);
    expect(res.body.data.result.status).toBe('submitted');
  });

  it('should apply negative marking for wrong answers', async () => {
    const attemptRes = await request(app).post(`/api/v1/quizzes/${quizData.quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    const attemptId = attemptRes.body.data.attempt._id;

    const res = await request(app).post(`/api/v1/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({
        answers: [
          { questionId: quizData.q1Id, selectedOptionId: quizData.q1CorrectOptionId },
          { questionId: quizData.q2Id, selectedOptionId: quizData.q2WrongOptionId },
        ],
      });

    expect(res.status).toBe(200);
    // 2 marks for correct - 0.5 penalty (25% of 2 marks) = 1.5
    expect(res.body.data.result.scoredMarks).toBe(1.5);
    expect(res.body.data.result.wrongCount).toBe(1);
  });

  it('should prevent duplicate submission (idempotent)', async () => {
    const attemptRes = await request(app).post(`/api/v1/quizzes/${quizData.quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    const attemptId = attemptRes.body.data.attempt._id;

    const answers = {
      answers: [
        { questionId: quizData.q1Id, selectedOptionId: quizData.q1CorrectOptionId },
        { questionId: quizData.q2Id, selectedOptionId: quizData.q2CorrectOptionId },
      ],
    };

    // First submission
    const res1 = await request(app).post(`/api/v1/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send(answers);
    expect(res1.status).toBe(200);

    // Second submission — should return same result (idempotent)
    const res2 = await request(app).post(`/api/v1/attempts/${attemptId}/submit`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send(answers);
    expect(res2.status).toBe(200);
    expect(res2.body.data.result.scoredMarks).toBe(res1.body.data.result.scoredMarks);
  });

  it('should respect max attempts', async () => {
    // maxAttempts is 2
    // First attempt
    const a1 = await request(app).post(`/api/v1/quizzes/${quizData.quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    await request(app).post(`/api/v1/attempts/${a1.body.data.attempt._id}/submit`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ answers: [{ questionId: quizData.q1Id, selectedOptionId: quizData.q1CorrectOptionId }] });

    // Second attempt
    const a2 = await request(app).post(`/api/v1/quizzes/${quizData.quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    await request(app).post(`/api/v1/attempts/${a2.body.data.attempt._id}/submit`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ answers: [{ questionId: quizData.q1Id, selectedOptionId: quizData.q1CorrectOptionId }] });

    // Third attempt should fail
    const a3 = await request(app).post(`/api/v1/quizzes/${quizData.quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    expect(a3.status).toBe(400);
    expect(a3.body.error).toMatch(/maximum attempts/i);
  });

  it('should prevent accessing another participant\'s attempt', async () => {
    const attemptRes = await request(app).post(`/api/v1/quizzes/${quizData.quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    const attemptId = attemptRes.body.data.attempt._id;

    const { token: otherToken } = await createParticipant('other@test.com');

    const res = await request(app).get(`/api/v1/attempts/${attemptId}/questions`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════
// TIME LIMIT
// ═══════════════════════════════════════════════════════════
describe('Time Limit Enforcement', () => {
  let adminToken, participantToken, quizId;

  beforeEach(async () => {
    adminToken = await createAdmin();
    const p = await createParticipant();
    participantToken = p.token;

    // Create a quiz with 1-minute time limit
    const quizRes = await request(app).post('/api/v1/quizzes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Timed Quiz', timeLimitMinutes: 1, maxAttempts: 5 });
    quizId = quizRes.body.data.quiz._id;

    await request(app).post(`/api/v1/quizzes/${quizId}/questions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Q1', options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }], marks: 1 });

    await request(app).patch(`/api/v1/quizzes/${quizId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  it('should set expiresAt based on time limit', async () => {
    const res = await request(app).post(`/api/v1/quizzes/${quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    const startedAt = new Date(res.body.data.attempt.startedAt);
    const expiresAt = new Date(res.body.data.attempt.expiresAt);
    const diffMinutes = (expiresAt - startedAt) / (1000 * 60);
    expect(Math.round(diffMinutes)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// RESULTS & LEADERBOARD
// ═══════════════════════════════════════════════════════════
describe('Results & Leaderboard', () => {
  let adminToken, participantToken, quizData;

  beforeEach(async () => {
    adminToken = await createAdmin();
    const p = await createParticipant();
    participantToken = p.token;
    quizData = await createQuizWithQuestions(adminToken);

    // Submit an attempt
    const attemptRes = await request(app).post(`/api/v1/quizzes/${quizData.quizId}/attempts`)
      .set('Authorization', `Bearer ${participantToken}`);
    await request(app).post(`/api/v1/attempts/${attemptRes.body.data.attempt._id}/submit`)
      .set('Authorization', `Bearer ${participantToken}`)
      .send({ answers: [
        { questionId: quizData.q1Id, selectedOptionId: quizData.q1CorrectOptionId },
        { questionId: quizData.q2Id, selectedOptionId: quizData.q2CorrectOptionId },
      ] });
  });

  it('should return my results', async () => {
    const res = await request(app).get('/api/v1/users/me/results')
      .set('Authorization', `Bearer ${participantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.results).toHaveLength(1);
    expect(res.body.data.results[0].percentage).toBe(100);
  });

  it('should return leaderboard', async () => {
    const res = await request(app).get(`/api/v1/quizzes/${quizData.quizId}/leaderboard`)
      .set('Authorization', `Bearer ${participantToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.leaderboard).toHaveLength(1);
    expect(res.body.data.leaderboard[0].rank).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════
// HEALTH
// ═══════════════════════════════════════════════════════════
describe('Health', () => {
  it('should return health status', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
  });
});
