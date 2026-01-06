import mongoose from "mongoose";

const QuizAttemptSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
    default: null
  },
  answers: {
    type: [Number],
    default: () => []
  },
  score: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  completedAt: {
    type: Date,
    default: null
  },
  durationSeconds: {
    type: Number,
    default: 0
  },
  metadata: {
    type: Object,
    default: () => ({})
  }
}, {
  timestamps: true
});

QuizAttemptSchema.index({ user: 1, createdAt: -1 });
QuizAttemptSchema.index({ quiz: 1, user: 1 });

export default mongoose.models.QuizAttempt || mongoose.model("QuizAttempt", QuizAttemptSchema);
