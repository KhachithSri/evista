import fetch from 'node-fetch';
import { getTargetLanguage } from '../utils/helpers.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Generate enhanced summary from transcript AND visual content
 * @param {string} transcript - Audio transcript
 * @param {array} visualAnalyses - Visual content from frames
 * @param {string} language - Target language
 * @returns {Promise<string>} - Enhanced summary
 */
export async function generateEnhancedSummary(transcript, visualAnalyses = [], language = 'english') {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured in .env file');
  }

  if (!transcript?.trim()) {
    throw new Error('Transcript is empty. Cannot generate enhanced summary without transcript.');
  }

  const targetLanguage = getTargetLanguage(language);

  // Format visual content
  let visualContent = '';
  if (visualAnalyses && visualAnalyses.length > 0) {
    visualContent = '\n\n=== VISUAL CONTENT ANALYSIS ===\n\n';
    visualAnalyses.forEach((analysis, index) => {
      const minutes = Math.floor(analysis.timestamp / 60);
      const seconds = Math.floor(analysis.timestamp % 60);
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      visualContent += `[Time ${timeStr}]\n${analysis.description}\n\n`;
    });
  }

  const prompt = `ROLE:
You are an expert educational video content summarizer with the ability to analyze and merge spoken explanations and on-screen visual information.

OBJECTIVE:
Generate a DETAILED and COMPREHENSIVE summary by combining insights from:
1. AUDIO TRANSCRIPT (what is spoken)
2. VISUAL CONTENT (slides, text, diagrams, code, demonstrations)

IMPORTANT:
Assume that some critical information may exist ONLY in audio or ONLY in visuals.

TASK RULES:
• Analyze audio and visual inputs separately, then integrate them
• Do not repeat content blindly; merge overlapping ideas meaningfully
• Capture definitions, explanations, and instructor commentary from audio
• Capture all written, graphical, and diagrammatic information from visuals

VISUAL CONTENT FOCUS:
• Slide titles, headings, bullet points
• Highlighted keywords and annotations
• Diagrams, charts, graphs, and tables
• Code snippets, algorithms, formulas, equations
• Visual demonstrations, workflows, or step sequences
• Any text shown on screen but not spoken aloud

SUMMARY REQUIREMENTS:
• Minimum length: 600 words
• Must be understandable without watching the video
• Must include both spoken-only and visual-only information

STRUCTURE GUIDELINES:
1. Overview of the topic
2. Main concepts (integrating audio + visuals)
3. Key points shown in slides or on screen
4. Detailed explanations of important ideas
5. Examples, demonstrations, or case studies
6. Conclusions and key takeaways

OUTPUT FORMAT:
• Plain text only
• Use bullet points (•) and numbered lists only
• Do NOT use markdown formatting symbols
• Maintain clear paragraph separation

LANGUAGE CONSTRAINT:
• Write strictly in: ${targetLanguage}

INPUTS:
AUDIO TRANSCRIPT:
${transcript}

VISUAL CONTENT:
${visualContent}

FINAL OUTPUT:
Produce a detailed, well-structured summary in ${targetLanguage} that fully integrates both audio transcript and visual content.
`;

  const maxRetries = 5;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Enhanced Summary] Attempt ${attempt}/${maxRetries} - Generating summary...`);
      
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.5, 
            topK: 32, 
            topP: 0.9, 
            maxOutputTokens: 8192,
            stopSequences: []
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorData = (() => { try { return JSON.parse(errorText); } catch { return {}; } })();
        
        console.error(`[Enhanced Summary] Error ${response.status}:`, errorText.substring(0, 500));
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s, 32s
          console.log(`[Enhanced Summary] Rate limited (429). Attempt ${attempt}/${maxRetries}. Waiting ${waitTime}ms...`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // Handle quota exceeded (RESOURCE_EXHAUSTED)
        if (response.status === 429 || errorText.includes('RESOURCE_EXHAUSTED') || errorText.includes('quotaExceeded')) {
          const quotaError = 'Gemini API quota exceeded. The free tier daily limit has been reached. Please try again tomorrow or upgrade to a paid plan.';
          console.error(`[Enhanced Summary] ${quotaError}`);
          throw new Error(quotaError);
        }
        
        throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content) {
        throw new Error('Invalid response from Gemini API');
      }

      console.log(`[Enhanced Summary] ✅ Success on attempt ${attempt}`);
      return data.candidates[0].content.parts[0].text
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .trim();
    } catch (error) {
      lastError = error;
      console.error(`[Enhanced Summary] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries && (error.message.includes('429') || error.message.includes('timeout'))) {
        console.log(`[Enhanced Summary] Retrying...`);
        continue;
      }
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to generate enhanced summary: ${error.message}`);
      }
    }
  }

  throw lastError || new Error('Failed to generate enhanced summary after retries');
}
