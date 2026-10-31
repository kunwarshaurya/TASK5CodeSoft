import mongoose from 'mongoose';

const QUIZ_STATUSES = ['draft', 'published', 'unpublished'];

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Quiz title is required'],
      trim: true,
      minlength: 1,
      maxlength: 300,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      maxlength: 100,
      default: 'General',
    },
    status: {
      type: String,
      enum: QUIZ_STATUSES,
      default: 'draft',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Quiz settings
    timeLimitMinutes: {
      type: Number,
      min: 1,
      max: 600,
      default: 30,
    },
    passingScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
      // Percentage required to pass
    },
    negativeMarking: {
      type: Boolean,
      default: false,
    },
    negativeMarkingPenalty: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.25,
      // Fraction of marks deducted for wrong answer (0.25 = 25% of question marks)
    },
    shuffleQuestions: {
      type: Boolean,
      default: false,
    },
    shuffleOptions: {
      type: Boolean,
      default: false,
    },
    maxAttempts: {
      type: Number,
      min: 1,
      max: 100,
      default: 1,
    },
    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
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

quizSchema.index({ status: 1 });
quizSchema.index({ createdBy: 1 });
quizSchema.index({ category: 1 });
quizSchema.index({ title: 'text', description: 'text' });

export { QUIZ_STATUSES };
const Quiz = mongoose.model('Quiz', quizSchema);
export default Quiz;
