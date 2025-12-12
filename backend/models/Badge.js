import mongoose from "mongoose";

const BadgeDefinitionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: "🏆"
  },
  category: {
    type: String,
    enum: ["quiz", "summary", "chat", "streak", "achievement"],
    default: "achievement"
  },
  criteria: {
    type: Object,
    default: () => ({})
  },
  rarity: {
    type: String,
    enum: ["common", "uncommon", "rare", "epic", "legendary"],
    default: "common"
  }
}, {
  timestamps: true
});

BadgeDefinitionSchema.index({ code: 1 });

export default mongoose.models.BadgeDefinition || mongoose.model("BadgeDefinition", BadgeDefinitionSchema);
