import mongoose from "mongoose";

const UserBadgeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  badge: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BadgeDefinition",
    required: true
  },
  awardedAt: {
    type: Date,
    default: () => new Date()
  },
  metadata: {
    type: Object,
    default: () => ({})
  }
}, {
  timestamps: true
});

UserBadgeSchema.index({ user: 1, badge: 1 }, { unique: true });
UserBadgeSchema.index({ user: 1, awardedAt: -1 });

export default mongoose.models.UserBadge || mongoose.model("UserBadge", UserBadgeSchema);
