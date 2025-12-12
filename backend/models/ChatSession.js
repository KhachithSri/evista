import mongoose from "mongoose";

const ChatSessionSchema = new mongoose.Schema({
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
  summary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Summary",
    default: null
  },
  title: {
    type: String,
    default: "Untitled Chat"
  },
  language: {
    type: String,
    default: "english"
  },
  messagesCount: {
    type: Number,
    default: 0
  },
  lastMessageAt: {
    type: Date,
    default: null
  },
  metadata: {
    type: Object,
    default: () => ({})
  }
}, {
  timestamps: true
});

ChatSessionSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.models.ChatSession || mongoose.model("ChatSession", ChatSessionSchema);
