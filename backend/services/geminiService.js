import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { getTargetLanguage } from '../utils/helpers.js';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Unified Gemini API caller with error handling and JSON parsing
 */
async function callGeminiAPI(prompt, maxTokens = 8192) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured in .env file');
  }

  const maxRetries = 5;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Gemini API] Attempt ${attempt}/${maxRetries} - Calling API...`);
      
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.5,
            topK: 32,
            topP: 0.9,
            maxOutputTokens: maxTokens,
            stopSequences: []
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Gemini API] Error ${response.status}:`, errorText.substring(0, 500));
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s, 32s
          console.log(`[Gemini API] Rate limited (429). Attempt ${attempt}/${maxRetries}. Waiting ${waitTime}ms...`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // Handle quota exceeded (RESOURCE_EXHAUSTED)
        if (response.status === 429 || errorText.includes('RESOURCE_EXHAUSTED') || errorText.includes('quotaExceeded')) {
          const quotaError = 'Gemini API quota exceeded. The free tier daily limit has been reached. Please try again tomorrow or upgrade to a paid plan.';
          console.error(`[Gemini API] ${quotaError}`);
          throw new Error(quotaError);
        }
        
        throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content) {
        throw new Error('Invalid response from Gemini API');
      }

      console.log(`[Gemini API] ✅ Success on attempt ${attempt}`);
      return data.candidates[0].content.parts[0].text;
    } catch (error) {
      lastError = error;
      console.error(`[Gemini API] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries && (error.message.includes('429') || error.message.includes('timeout'))) {
        console.log(`[Gemini API] Retrying...`);
        continue;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Gemini API call failed after retries');
}

/**
 * Parse and clean JSON response from Gemini
 */
function parseGeminiJSON(text, arrayKey) {
  console.log(`Raw Gemini response length: ${text.length}`);
  
  // Clean up markdown code blocks
  let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  // Extract JSON if embedded
  const jsonMatch = cleaned.match(/\{[\s\S]*"${arrayKey}"[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  
  // Fix truncated JSON
  if (!cleaned.endsWith('}')) {
    console.log('⚠️ JSON appears truncated, attempting to fix...');
    const lastComplete = cleaned.lastIndexOf('},');
    if (lastComplete > 0) {
      cleaned = cleaned.substring(0, lastComplete + 1) + '\n  ]\n}';
      console.log('Fixed truncated JSON');
    }
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.error('JSON parse error:', parseError.message);
    console.error('Failed text preview:', cleaned.substring(0, 500));
    throw new Error(`Failed to parse JSON: ${parseError.message}`);
  }
}

/**
 * Generate summary from transcript
 */
export async function summarizeWithGemini(transcript, language = 'english') {
  const targetLanguage = getTargetLanguage(language);
  
  const prompt = `You are an expert educational content summarizer. Create a DETAILED and COMPREHENSIVE summary of the following video transcript in ${targetLanguage} language.

IMPORTANT REQUIREMENTS:
1. **Content Focus**: Summarize ONLY the educational content, topics, and concepts discussed
   - DO NOT include information about the video creator, channel, or presenter
   - DO NOT mention video metadata (likes, views, upload date, etc.)
   - Focus ONLY on the subject matter and educational content

2. **Length**: Write a thorough summary (minimum 500 words)

3. **Format**: Write in clean, flowing paragraphs
   - DO NOT use markdown headers (##, ###, ####)
   - DO NOT use section titles with special formatting
   - Use simple paragraph breaks to separate topics
   - Use bullet points (•) or numbered lists (1., 2., 3.) within paragraphs if needed

4. **Structure**: Organize naturally:
   - Start with a brief overview of the main topic
   - Explain key concepts and ideas in detail
   - Include specific examples, numbers, and data mentioned
   - Cover step-by-step processes if explained
   - End with important conclusions or takeaways

5. **Detail Level**: Include:
   - All major points and sub-points
   - Explanations of concepts
   - Context and background information
   - Practical applications if mentioned

6. **Language**: Write entirely in ${targetLanguage}

Make the summary detailed and informative, focusing purely on the educational content.

Transcript:
${transcript}

Write the clean, detailed summary in ${targetLanguage} (no markdown headers, no video metadata):`;

  const rawSummary = await callGeminiAPI(prompt, 8192);
  
  // Clean up any remaining markdown headers and extra formatting
  let cleanedSummary = rawSummary
    .replace(/^#{1,6}\s+/gm, '')  // Remove markdown headers at start of lines
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold formatting
    .replace(/\*([^*]+)\*/g, '$1')  // Remove italic formatting
    .replace(/^\s*[-*]\s+/gm, '• ')  // Normalize bullet points
    .replace(/\n{3,}/g, '\n\n')  // Remove excessive line breaks
    .trim();
  
  return cleanedSummary;
}

/**
 * Generate quiz questions from summary
 */
export async function generateQuizWithGemini(summary, language = 'english', numQuestions = 12) {
  const targetLanguage = getTargetLanguage(language);

  const prompt = `You are a quiz generator. Based on the following video summary, generate exactly ${numQuestions} multiple-choice quiz questions in ${targetLanguage} language.

CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. Generate exactly ${numQuestions} questions
3. Each question must have exactly 4 options
4. correctAnswer must be a number (0, 1, 2, or 3)
5. All text must be in ${targetLanguage} language

Summary:
${summary}

Return ONLY this JSON structure (no markdown code blocks):
{
  "questions": [
    {
      "question": "Question text in ${targetLanguage}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Brief explanation in ${targetLanguage}",
      "difficulty": "easy"
    }
  ]
}

Generate the JSON now:`;

  const responseText = await callGeminiAPI(prompt, 8192);
  const quizData = parseGeminiJSON(responseText, 'questions');
  
  if (!quizData.questions || !Array.isArray(quizData.questions)) {
    throw new Error('Invalid quiz format from Gemini API');
  }

  console.log(`Parsed ${quizData.questions.length} questions from response`);
  
  const questions = quizData.questions.slice(0, numQuestions);
  
  // Validate each question
  questions.forEach((q, index) => {
    if (!q.question || !q.options || !Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`Invalid question format at index ${index}`);
    }
    if (typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
      throw new Error(`Invalid correctAnswer at index ${index}`);
    }
  });

  return questions;
}

/**
 * Generate flashcards from content
 */
export async function generateFlashcardsWithGemini(content, language = 'english', numCards = 10, type = 'summary') {
  const targetLanguage = getTargetLanguage(language);

  const baseRequirements = `CRITICAL REQUIREMENTS:
1. Return ONLY valid JSON - no markdown, no explanations, no extra text
2. Generate exactly ${numCards} flashcards
3. Each flashcard must have:
   - "front": Question or term in ${targetLanguage}
   - "back": Answer or definition in ${targetLanguage}
   - "emoji": A relevant emoji that represents the concept
   - "color": A hex color code that fits the topic
   - "category": Category name
4. All text must be in ${targetLanguage} language
5. Choose emojis that help visual memory and make learning fun

Return ONLY this JSON structure (no markdown code blocks):
{
  "flashcards": [
    {
      "front": "Question or term in ${targetLanguage}",
      "back": "Answer or definition in ${targetLanguage}",
      "emoji": "🎯",
      "color": "#667eea",
      "category": "Category name"
    }
  ]
}`;

  const prompt = type === 'topic' 
    ? `You are a flashcard generator. Create exactly ${numCards} educational flashcards about the topic: "${content}" in ${targetLanguage} language.

${baseRequirements}

Generate the JSON now:`
    : `You are a flashcard generator. Based on the following summary, create exactly ${numCards} educational flashcards in ${targetLanguage} language.

${baseRequirements}

Summary:
${content}

Generate the JSON now:`;

  const responseText = await callGeminiAPI(prompt, 8192);
  const flashcardData = parseGeminiJSON(responseText, 'flashcards');
  
  if (!flashcardData.flashcards || !Array.isArray(flashcardData.flashcards)) {
    throw new Error('Invalid flashcard format from Gemini API');
  }

  console.log(`Parsed ${flashcardData.flashcards.length} flashcards from response`);
  
  const flashcards = flashcardData.flashcards.slice(0, numCards);
  
  // Validate each flashcard
  flashcards.forEach((card, index) => {
    if (!card.front || !card.back) {
      throw new Error(`Invalid flashcard format at index ${index}`);
    }
  });

  return flashcards;
}
