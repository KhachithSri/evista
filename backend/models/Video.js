import mongoose from "mongoose";

const VideoSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ["youtube", "vimeo", "local"],
    required: true
  },
  videoId: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  channelTitle: {
    type: String,
    default: null
  },
  duration: {
    type: String,
    default: null
  },
  thumbnails: {
    type: Object,
    default: () => ({})
  },
  metadata: {
    type: Object,
    default: () => ({})
  }
}, {
  timestamps: true
});

VideoSchema.index({ platform: 1, videoId: 1 }, { unique: true });

export default mongoose.models.Video || mongoose.model("Video", VideoSchema);
