import mongoose from "mongoose";

const StatsSchema = new mongoose.Schema({
  summariesGenerated: { type: Number, default: 0 },
  quizzesGenerated: { type: Number, default: 0 },
  quizzesCompleted: { type: Number, default: 0 },
  bestQuizScore: { type: Number, default: 0 },
  chatQuestionsAsked: { type: Number, default: 0 },
  xp: { type: Number, default: 0 },
  streakDays: { type: Number, default: 0 },
  lastActivityAt: { type: Date, default: null }
}, { _id: false });

const PreferencesSchema = new mongoose.Schema({
  defaultLanguage: { type: String, default: "english" },
  theme: { type: String, default: "light" }
}, { _id: false });

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  preferences: {
    type: PreferencesSchema,
    default: () => ({})
  },
  stats: {
    type: StatsSchema,
    default: () => ({})
  },
  lastLoginAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

UserSchema.index({ email: 1 });

export default mongoose.models.User || mongoose.model("User", UserSchema);
