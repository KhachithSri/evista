import fetch from 'node-fetch';
import { getTargetLanguage } from '../utils/helpers.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Generate summary from ONLY visual content (no transcript)
 * Used when transcription fails or video has no speech (music videos, etc.)
 * @param {array} visualAnalyses - Visual content from frames
 * @param {string} language - Target language
 * @returns {Promise<string>} - Visual-only summary
 */
export async function generateVisualOnlySummary(visualAnalyses, language = 'english') {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured in .env file');
  }

  if (!visualAnalyses?.length) {
    throw new Error('No visual content available for summary');
  }

  const targetLanguage = getTargetLanguage(language);

  // Format visual content
  let visualContent = '=== VISUAL CONTENT ANALYSIS ===\n\n';
  visualContent += `Total frames analyzed: ${visualAnalyses.length}\n\n`;
  
  visualAnalyses.forEach((analysis, index) => {
    const minutes = Math.floor(analysis.timestamp / 60);
    const seconds = Math.floor(analysis.timestamp % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    visualContent += `[Time ${timeStr}]\n${analysis.description}\n\n`;
  });

  const prompt = `You are an expert content analyzer. Create a DETAILED and COMPREHENSIVE summary based ONLY on the visual content from this video.

IMPORTANT CONTEXT:
- This video has NO AUDIO TRANSCRIPT (it may be a music video, instrumental, or the audio transcription failed)
- You ONLY have visual information from video frames
- Create a complete summary based solely on what was SHOWN in the video

REQUIREMENTS:
1. **Visual Focus**: Describe what was shown in the video:
   - Text and titles displayed
   - Visual scenes and content
   - Any diagrams, charts, or graphics
   - Actions and demonstrations
   - People, objects, and settings
   - Changes over time
2. **Structure**: Organize the summary:
   - Overview of the video content
   - Chronological description of visual elements
   - Key visual themes and patterns
   - Important text or information shown
   - Overall message or purpose
3. **Length**: Write a thorough summary (minimum 400 words)
4. **Format**: Use plain text with bullet points (•) and numbered lists. NO markdown symbols (##, **, *, etc.)
5. **Language**: Write entirely in ${targetLanguage}
6. **Completeness**: Make the summary as detailed as possible based on available visual information

Note: Since there is no audio, focus entirely on describing the visual content, text shown, and what can be understood from the imagery alone.

${visualContent}

Write the detailed visual-only summary in ${targetLanguage}:`;

  const maxRetries = 5;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Visual Summary] Attempt ${attempt}/${maxRetries} - Generating visual summary...`);
      
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
        
        console.error(`[Visual Summary] Error ${response.status}:`, errorText.substring(0, 500));
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s, 32s
          console.log(`[Visual Summary] Rate limited (429). Attempt ${attempt}/${maxRetries}. Waiting ${waitTime}ms...`);
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        // Handle quota exceeded (RESOURCE_EXHAUSTED)
        if (response.status === 429 || errorText.includes('RESOURCE_EXHAUSTED') || errorText.includes('quotaExceeded')) {
          const quotaError = 'Gemini API quota exceeded. The free tier daily limit has been reached. Please try again tomorrow or upgrade to a paid plan.';
          console.error(`[Visual Summary] ${quotaError}`);
          throw new Error(quotaError);
        }
        
        throw new Error(`Gemini API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      
      if (!data.candidates?.[0]?.content) {
        throw new Error('Invalid response from Gemini API');
      }

      console.log(`[Visual Summary] ✅ Success on attempt ${attempt}`);
      const summary = data.candidates[0].content.parts[0].text
        .replace(/#{1,6}\s/g, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .trim();
      
      return `[Note: This summary is based only on visual content. Audio transcription was not available.]\n\n${summary}`;
    } catch (error) {
      lastError = error;
      console.error(`[Visual Summary] Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries && (error.message.includes('429') || error.message.includes('timeout'))) {
        console.log(`[Visual Summary] Retrying...`);
        continue;
      }
      
      if (attempt === maxRetries) {
        throw new Error(`Failed to generate visual-only summary: ${error.message}`);
      }
    }
  }

  throw lastError || new Error('Failed to generate visual-only summary after retries');
}
