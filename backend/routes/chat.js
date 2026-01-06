import express from "express";
import fetch from "node-fetch";
import jwt from "jsonwebtoken";
import { getTargetLanguage, handleError } from "../utils/helpers.js";
import { verifyToken } from "../middleware/auth.js";
import ChatSession from "../models/ChatSession.js";
import ChatMessage from "../models/ChatMessage.js";
import { updateUserStats } from "../services/badgeService.js";

const router = express.Router();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * POST /api/chat
 * Chat endpoint - AI assistant for video content (optional auth for persistence)
 */
router.post("/", async (req, res) => {
  try {
    const { message, context, language, sessionId } = req.body;

    // Optional authentication: decode JWT if provided, but allow anonymous access
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ") && JWT_SECRET) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userId = decoded.userId;
      } catch (tokenError) {
        console.warn("Chat: Invalid or expired JWT provided. Proceeding without user context.");
      }
    }

    if (!message) return res.status(400).json({ error: "Message is required" });
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const targetLanguage = getTargetLanguage(language);

    // Build prompt with context
    const prompt = `You are an AI assistant helping users understand video content. You have access to the video summary/transcript below.

VIDEO CONTENT:
${context || 'No context available yet. Ask the user to generate a summary first.'}

USER QUESTION: ${message}

INSTRUCTIONS:
- Answer the user's question based on the video content above
- Be helpful, concise, and accurate
- If the question is not related to the video content, politely guide them back to the topic
- Respond in ${targetLanguage} language
- Keep responses under 200 words
- Use a friendly, conversational tone

Your response:`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    const aiResponse = data.candidates[0].content.parts[0].text;

    let persistedSessionId = null;

    // Persist chat if user is authenticated
    if (userId) {
      try {
        let chatSession = null;

        if (sessionId) {
          chatSession = await ChatSession.findById(sessionId).catch(() => null);
        }

        if (!chatSession) {
          chatSession = new ChatSession({
            user: userId,
            language: language || 'english',
            title: message.substring(0, 50) + '...'
          });
          await chatSession.save();
        }

        // Save user message
        await ChatMessage.create({
          session: chatSession._id,
          user: userId,
          role: 'user',
          content: message
        });

        // Save assistant response
        await ChatMessage.create({
          session: chatSession._id,
          role: 'assistant',
          content: aiResponse
        });

        // Update chat session
        chatSession.messagesCount += 2;
        chatSession.lastMessageAt = new Date();
        await chatSession.save();

        // Update user stats
        await updateUserStats(userId, { "stats.chatQuestionsAsked": 1 });

        persistedSessionId = chatSession._id.toString();
      } catch (persistError) {
        console.error("Failed to persist chat:", persistError);
        // Don't fail the response if persistence fails
      }
    }
    
    res.json({ response: aiResponse, sessionId: persistedSessionId });

  } catch (error) {
    handleError(res, error, "Failed to generate response");
  }
});

export default router;
