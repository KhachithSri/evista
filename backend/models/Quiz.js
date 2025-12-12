import mongoose from "mongoose";

const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: {
    type: [String],
    validate: [arr => arr.length === 4, "Each question must have exactly 4 options"],
    required: true
  },
  correctAnswer: {
    type: Number,
    min: 0,
    max: 3,
    required: true
  },
  explanation: {
    type: String,
    default: ""
  },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "easy"
  }
}, { _id: false });

const QuizSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  summary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Summary",
    required: true
  },
  language: {
    type: String,
    default: "english"
  },
  questions: {
    type: [QuestionSchema],
    default: () => []
  },
  questionCount: {
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

QuizSchema.index({ user: 1, createdAt: -1 });

QuizSchema.pre("save", function preSave(next) {
  if (this.questions?.length) {
    this.questionCount = this.questions.length;
  }
  next();
});

export default mongoose.models.Quiz || mongoose.model("Quiz", QuizSchema);
