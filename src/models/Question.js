import mongoose from 'mongoose';

const optionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Option text is required'],
      trim: true,
      maxlength: 1000,
    },
    isCorrect: {
      type: Boolean,
      default: false,
      // SECURITY: This field must NEVER be returned to participants before submission
    },
  },
  { _id: true }
);

const questionSchema = new mongoose.Schema(
  {
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quiz',
      required: [true, 'Quiz reference is required'],
    },
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
      maxlength: 5000,
    },
    options: {
      type: [optionSchema],
      validate: {
        validator: function (opts) {
          return opts.length >= 2 && opts.length <= 6;
        },
        message: 'A question must have between 2 and 6 options',
      },
    },
    marks: {
      type: Number,
      min: 1,
      max: 100,
      default: 1,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
      // Shown to participant after submission
    },
    order: {
      type: Number,
      default: 0,
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

questionSchema.index({ quiz: 1, order: 1 });

/**
 * Serialize question for participant — strips correct answer info.
 * CRITICAL: Use this method for all participant-facing responses.
 */
questionSchema.methods.toParticipantJSON = function () {
  const obj = this.toJSON();
  obj.options = obj.options.map((opt) => ({
    _id: opt._id,
    text: opt.text,
    // isCorrect is deliberately omitted
  }));
  delete obj.explanation; // Hide until after submission
  return obj;
};

/**
 * Serialize question for admin — includes correct answers.
 */
questionSchema.methods.toAdminJSON = function () {
  return this.toJSON();
};

const Question = mongoose.model('Question', questionSchema);
export default Question;
