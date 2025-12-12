import User from "../models/User.js";
import UserBadge from "../models/UserBadge.js";
import BadgeDefinition from "../models/Badge.js";

/**
 * Initialize default badges in the database
 */
export async function initializeBadges() {
  try {
    const badges = [
      {
        code: "FIRST_SUMMARY",
        name: "First Steps",
        description: "Generated your first summary",
        icon: "🎯",
        category: "summary",
        rarity: "common"
      },
      {
        code: "FIVE_SUMMARIES",
        name: "Summary Master",
        description: "Generated 5 summaries",
        icon: "📚",
        category: "summary",
        rarity: "uncommon"
      },
      {
        code: "FIRST_QUIZ",
        name: "Quiz Starter",
        description: "Completed your first quiz",
        icon: "❓",
        category: "quiz",
        rarity: "common"
      },
      {
        code: "PERFECT_SCORE",
        name: "Perfect Mind",
        description: "Scored 100% on a quiz",
        icon: "💯",
        category: "quiz",
        rarity: "rare"
      },
      {
        code: "FIVE_QUIZZES",
        name: "Quiz Champion",
        description: "Completed 5 quizzes",
        icon: "🏅",
        category: "quiz",
        rarity: "uncommon"
      },
      {
        code: "CHAT_EXPLORER",
        name: "Chat Explorer",
        description: "Asked 10 questions in chat",
        icon: "💬",
        category: "chat",
        rarity: "common"
      },
      {
        code: "LEARNING_STREAK",
        name: "On Fire",
        description: "Maintained a 7-day learning streak",
        icon: "🔥",
        category: "streak",
        rarity: "epic"
      },
      {
        code: "KNOWLEDGE_SEEKER",
        name: "Knowledge Seeker",
        description: "Earned 1000 XP",
        icon: "🧠",
        category: "achievement",
        rarity: "rare"
      }
    ];

    for (const badgeData of badges) {
      await BadgeDefinition.updateOne(
        { code: badgeData.code },
        badgeData,
        { upsert: true }
      );
    }

    console.log("✅ Badges initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize badges:", error);
  }
}

/**
 * Award a badge to a user
 */
export async function awardBadge(userId, badgeCode, metadata = {}) {
  try {
    const badge = await BadgeDefinition.findOne({ code: badgeCode });
    if (!badge) {
      console.warn(`Badge not found: ${badgeCode}`);
      return null;
    }

    // Check if user already has this badge
    const existingBadge = await UserBadge.findOne({
      user: userId,
      badge: badge._id
    });

    if (existingBadge) {
      return existingBadge; // Already awarded
    }

    // Award the badge
    const userBadge = new UserBadge({
      user: userId,
      badge: badge._id,
      metadata
    });

    await userBadge.save();

    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { "stats.xp": 50 }
    });

    console.log(`✅ Badge awarded: ${badgeCode} to user ${userId}`);
    return userBadge;
  } catch (error) {
    console.error("❌ Failed to award badge:", error);
    return null;
  }
}

/**
 * Check and award badges based on user activity
 */
export async function checkAndAwardBadges(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const stats = user.stats;

    // First Summary
    if (stats.summariesGenerated === 1) {
      await awardBadge(userId, "FIRST_SUMMARY");
    }

    // Five Summaries
    if (stats.summariesGenerated === 5) {
      await awardBadge(userId, "FIVE_SUMMARIES");
    }

    // First Quiz
    if (stats.quizzesCompleted === 1) {
      await awardBadge(userId, "FIRST_QUIZ");
    }

    // Five Quizzes
    if (stats.quizzesCompleted === 5) {
      await awardBadge(userId, "FIVE_QUIZZES");
    }

    // Chat Explorer (10 questions)
    if (stats.chatQuestionsAsked === 10) {
      await awardBadge(userId, "CHAT_EXPLORER");
    }

    // Knowledge Seeker (1000 XP)
    if (stats.xp >= 1000) {
      await awardBadge(userId, "KNOWLEDGE_SEEKER");
    }
  } catch (error) {
    console.error("❌ Failed to check badges:", error);
  }
}

/**
 * Get all badges earned by a user
 */
export async function getUserBadges(userId) {
  try {
    const badges = await UserBadge.find({ user: userId })
      .populate("badge")
      .sort({ awardedAt: -1 });

    return badges;
  } catch (error) {
    console.error("❌ Failed to fetch user badges:", error);
    return [];
  }
}

/**
 * Update user stats and check for badge eligibility
 */
export async function updateUserStats(userId, statUpdates) {
  try {
    // Separate increment operations from set operations
    const incUpdates = {};
    const setUpdates = {};
    const maxUpdates = {};

    for (const [key, value] of Object.entries(statUpdates)) {
      if (key === "stats.bestQuizScore") {
        // Use $max for best score (keep the maximum)
        maxUpdates[key] = value;
      } else if (key === "stats.avgQuizScore") {
        // Use $set for average score
        setUpdates[key] = value;
      } else {
        // Use $inc for counters (summaries, quizzes, xp, etc.)
        incUpdates[key] = value;
      }
    }

    // Build the update object
    const updateObj = {};
    if (Object.keys(incUpdates).length > 0) {
      updateObj.$inc = incUpdates;
    }
    if (Object.keys(setUpdates).length > 0) {
      updateObj.$set = setUpdates;
    }
    if (Object.keys(maxUpdates).length > 0) {
      updateObj.$max = maxUpdates;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updateObj,
      { new: true }
    );

    console.log(`✅ User stats updated:`, { incUpdates, setUpdates, maxUpdates });

    // Check for badge eligibility
    await checkAndAwardBadges(userId);

    return user;
  } catch (error) {
    console.error("❌ Failed to update user stats:", error);
    return null;
  }
}
