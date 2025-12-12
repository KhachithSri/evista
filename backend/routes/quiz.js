import express from "express";
import { generateQuizWithGemini } from "../services/geminiService.js";
import { validateContent, handleError } from "../utils/helpers.js";
import { verifyToken } from "../middleware/auth.js";
import { updateUserStats } from "../services/badgeService.js";
import QuizAttempt from "../models/QuizAttempt.js";
import Quiz from "../models/Quiz.js";

const router = express.Router();

/**
 * POST /api/quiz
 * Generate quiz questions from a summary
 */
router.post("/", async (req, res) => {
  try {
    const { summary, language, numQuestions } = req.body;
    
    const validation = validateContent(summary, 50, 'Summary');
    if (!validation.valid) {
      return res.status(400).json(validation);
    }

    const questions = await generateQuizWithGemini(summary, language || 'english', numQuestions || 12);

    if (!questions?.length) {
      throw new Error('No questions generated');
    }

    res.json({ questions, language: language || 'english', totalQuestions: questions.length });
  } catch (err) {
    handleError(res, err, "Failed to generate quiz");
  }
});

/**
 * POST /api/quiz/submit
 * Submit quiz answers and record completion
 */
router.post("/submit", verifyToken, async (req, res) => {
  try {
    const userId = req.userId || req.user?.userId;
    const { score, totalQuestions, answers, quizId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (score === undefined || !totalQuestions) {
      return res.status(400).json({ error: "Score and totalQuestions are required" });
    }

    // Calculate percentage
    const percentage = Math.round((score / totalQuestions) * 100);

    // Save quiz attempt to database
    const quizAttempt = new QuizAttempt({
      user: userId,
      quiz: quizId || null,
      answers: answers || [],
      score: score,
      percentage: percentage,
      completedAt: new Date(),
      durationSeconds: 0,
      metadata: {}
    });

    await quizAttempt.save();

    // Update user stats
    const statUpdates = {
      "stats.quizzesCompleted": 1,
      "stats.xp": Math.ceil(percentage) // Award XP based on score percentage
    };

    // Update best quiz score if this is better
    if (percentage > 0) {
      statUpdates["stats.bestQuizScore"] = percentage;
    }

    // Update average quiz score
    statUpdates["stats.avgQuizScore"] = percentage;

    await updateUserStats(userId, statUpdates);

    console.log(`✅ Quiz submitted - User: ${userId}, Score: ${score}/${totalQuestions} (${percentage}%)`);

    res.json({ 
      success: true, 
      message: "Quiz submitted successfully",
      xpEarned: Math.ceil(percentage),
      attemptId: quizAttempt._id
    });
  } catch (err) {
    handleError(res, err, "Failed to submit quiz");
  }
});

export default router;
