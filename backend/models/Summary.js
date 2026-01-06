import mongoose from "mongoose";

const SummarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  video: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Video",
    default: null
  },
  language: {
    type: String,
    default: "english"
  },
  summaryType: {
    type: String,
    enum: ["transcript_only", "visual_only", "enhanced"],
    default: "transcript_only"
  },
  content: {
    type: String,
    required: true
  },
  tokenUsage: {
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }
  },
  durationSeconds: {
    type: Number,
    default: null
  },
  metadata: {
    type: Object,
    default: () => ({})
  }
}, {
  timestamps: true
});

SummarySchema.index({ user: 1, createdAt: -1 });
SummarySchema.index({ video: 1, user: 1 });

export default mongoose.models.Summary || mongoose.model("Summary", SummarySchema);
