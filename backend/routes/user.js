import express from "express";
import { verifyToken } from "../middleware/auth.js";
import User from "../models/User.js";
import Summary from "../models/Summary.js";
import ChatSession from "../models/ChatSession.js";
import QuizAttempt from "../models/QuizAttempt.js";
import { getUserBadges } from "../services/badgeService.js";

const router = express.Router();

/**
 * GET /api/user/dashboard
 * Get personalized dashboard data (requires auth)
 */
router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get recent summaries
    const recentSummaries = await Summary.find({ user: req.userId })
      .populate("video", "title channelTitle")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
      .then(summaries => 
        summaries.map(s => ({
          ...s,
          video: s.video || { 
            title: s.metadata?.videoTitle || "Untitled Video",
            channelTitle: s.metadata?.channelTitle || "Unknown Channel"
          }
        }))
      );

    // Get recent chat sessions
    const recentChats = await ChatSession.find({ user: req.userId })
      .sort({ updatedAt: -1 })
      .limit(5);

    // Get quiz stats
    const quizAttempts = await QuizAttempt.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const avgQuizScore = quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((sum, q) => sum + (q.percentage || 0), 0) / quizAttempts.length)
      : 0;

    // Get badges
    const badges = await getUserBadges(req.userId);

    // Safely handle users that may not yet have a stats subdocument
    const stats = user.stats || {};

    // Filter out any badges where the populated badge definition is missing
    const safeBadges = badges
      .filter(b => b.badge)
      .map(b => ({
        id: b._id,
        code: b.badge.code,
        name: b.badge.name,
        description: b.badge.description,
        icon: b.badge.icon,
        rarity: b.badge.rarity,
        awardedAt: b.awardedAt
      }));

    res.json({
      user: {
        id: user._id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt
      },
      stats: {
        summariesGenerated: stats.summariesGenerated || 0,
        quizzesGenerated: stats.quizzesGenerated || 0,
        quizzesCompleted: stats.quizzesCompleted || 0,
        bestQuizScore: stats.bestQuizScore || 0,
        avgQuizScore,
        chatQuestionsAsked: stats.chatQuestionsAsked || 0,
        xp: stats.xp || 0,
        streakDays: stats.streakDays || 0
      },
      recentSummaries,
      recentChats,
      recentQuizzes: quizAttempts.slice(0, 5),
      badges: safeBadges
    });
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

/**
 * GET /api/user/summaries
 * Get all user summaries (requires auth)
 */
router.get("/summaries", verifyToken, async (req, res) => {
  try {
    const summaries = await Summary.find({ user: req.userId })
      .populate("video", "title channelTitle platform")
      .sort({ createdAt: -1 });

    res.json({ summaries });
  } catch (error) {
    console.error("Summaries fetch error:", error);
    res.status(500).json({ error: "Failed to fetch summaries" });
  }
});

/**
 * GET /api/user/chat-sessions
 * Get all user chat sessions (requires auth)
 */
router.get("/chat-sessions", verifyToken, async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user: req.userId })
      .sort({ updatedAt: -1 });

    res.json({ sessions });
  } catch (error) {
    console.error("Chat sessions fetch error:", error);
    res.status(500).json({ error: "Failed to fetch chat sessions" });
  }
});

/**
 * GET /api/user/quiz-history
 * Get user quiz attempt history (requires auth)
 */
router.get("/quiz-history", verifyToken, async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ user: req.userId })
      .populate("quiz", "questionCount language")
      .sort({ createdAt: -1 });

    res.json({ attempts });
  } catch (error) {
    console.error("Quiz history fetch error:", error);
    res.status(500).json({ error: "Failed to fetch quiz history" });
  }
});

/**
 * GET /api/user/badges
 * Get all user badges (requires auth)
 */
router.get("/badges", verifyToken, async (req, res) => {
  try {
    const badges = await getUserBadges(req.userId);

    res.json({
      badges: badges.map(b => ({
        id: b._id,
        code: b.badge.code,
        name: b.badge.name,
        description: b.badge.description,
        icon: b.badge.icon,
        category: b.badge.category,
        rarity: b.badge.rarity,
        awardedAt: b.awardedAt
      }))
    });
  } catch (error) {
    console.error("Badges fetch error:", error);
    res.status(500).json({ error: "Failed to fetch badges" });
  }
});

export default router;
