import express from "express";
import { generateFlashcardsWithGemini } from "../services/geminiService.js";
import { validateContent, handleError } from "../utils/helpers.js";

const router = express.Router();

/**
 * POST /api/flashcard
 * Generate flashcards from summary or topic
 */
router.post("/", async (req, res) => {
  try {
    const { content, language, numCards, type } = req.body;
    const generationType = type || 'summary';
    const minLength = generationType === 'topic' ? 3 : 50;
    
    const validation = validateContent(content, minLength, 'Content');
    if (!validation.valid) {
      return res.status(400).json(validation);
    }

    const flashcards = await generateFlashcardsWithGemini(content, language || 'english', numCards || 10, generationType);

    if (!flashcards?.length) {
      throw new Error('No flashcards generated');
    }

    res.json({ flashcards, language: language || 'english', totalCards: flashcards.length, type: generationType });
  } catch (err) {
    handleError(res, err, "Failed to generate flashcards");
  }
});

export default router;
