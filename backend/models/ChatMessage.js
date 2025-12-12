import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ChatSession",
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  role: {
    type: String,
    enum: ["user", "assistant", "system"],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  metadata: {
    type: Object,
    default: () => ({})
  }
}, {
  timestamps: true
});

ChatMessageSchema.index({ session: 1, createdAt: 1 });

export default mongoose.models.ChatMessage || mongoose.model("ChatMessage", ChatMessageSchema);
