import mongoose from 'mongoose';

const ATTEMPT_STATUSES = ['in-progress', 'submitted', 'expired'];

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    selectedOption: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      // null = unanswered
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    marksAwarded: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: true,
    },
    participant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ATTEMPT_STATUSES,
      default: 'in-progress',
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    // Ordered question IDs for this attempt (supports shuffle)
    questionOrder: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    answers: [answerSchema],
    // Scoring
    totalMarks: {
      type: Number,
      default: 0,
    },
    scoredMarks: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    correctCount: {
      type: Number,
      default: 0,
    },
    wrongCount: {
      type: Number,
      default: 0,
    },
    unansweredCount: {
      type: Number,
      default: 0,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    certificateEligible: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

attemptSchema.index({ quiz: 1, participant: 1 });
attemptSchema.index({ participant: 1, status: 1 });
attemptSchema.index({ quiz: 1, status: 1, percentage: -1 }); // For leaderboard

export { ATTEMPT_STATUSES };
const Attempt = mongoose.model('Attempt', attemptSchema);
export default Attempt;
