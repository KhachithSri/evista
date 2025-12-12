import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_VISION_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Extract frames from video for visual analysis using smart distribution
 * @param {string} videoPath - Path to video file
 * @param {object} options - Extraction options
 * @returns {Promise<object>} - Frame extraction results
 */
export async function extractFramesForAnalysis(videoPath, options = {}) {
  const {
    numFrames = 10, // Extract exactly 10 frames evenly distributed
    method = 'smart', // 'smart' for even distribution
    minGapSeconds = 10 // Minimum 10 seconds between frames
  } = options;

  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'frame_extractor.py');
    const outputFolder = path.join(__dirname, 'temp', `visual_frames_${Date.now()}`);
    const args = ['-3.10', pythonScript, videoPath, outputFolder, numFrames.toString(), method, minGapSeconds.toString()];

    console.log(`Extracting frames for visual analysis: ${videoPath}`);
    console.log(`Method: ${method}, Number of frames: ${numFrames}, Min gap: ${minGapSeconds}s`);

    const pythonProcess = spawn('py', args);
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.log('Frame extraction:', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Frame extraction error:', errorData);
        reject(new Error(`Frame extraction failed: ${errorData}`));
        return;
      }

      try {
        const result = JSON.parse(outputData);
        resolve(result);
      } catch (error) {
        reject(new Error(`Failed to parse frame extraction result: ${error.message}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

/**
 * Analyze a single frame using Gemini Vision API
 * @param {string} imagePath - Path to image file
 * @param {number} timestamp - Timestamp in video
 * @returns {Promise<object>} - Analysis result
 */
async function analyzeFrameWithGemini(imagePath, timestamp) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    // Read image and convert to base64
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `Analyze this video frame and provide a detailed description of:
1. Main visual content (what's shown on screen)
2. Any text visible (titles, labels, captions, code, formulas)
3. Diagrams, charts, or graphs (describe what they show)
4. Key visual elements (people, objects, scenes)
5. Any educational content (slides, presentations, demonstrations)

Be specific and detailed. Focus on educational and informational content.`;

    const response = await fetch(`${GEMINI_VISION_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: 'image/jpeg',
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          topK: 32,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gemini Vision] Error ${response.status}:`, errorText.substring(0, 500));
      
      // Handle quota exceeded (RESOURCE_EXHAUSTED)
      if (response.status === 429 || errorText.includes('RESOURCE_EXHAUSTED') || errorText.includes('quotaExceeded')) {
        const quotaError = 'Gemini API quota exceeded. The free tier daily limit has been reached. Please try again tomorrow or upgrade to a paid plan.';
        console.error(`[Gemini Vision] ${quotaError}`);
        throw new Error(quotaError);
      }
      
      throw new Error(`Gemini Vision API error: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();
    
    if (!data.candidates?.[0]?.content) {
      throw new Error('Invalid response from Gemini Vision API');
    }

    const description = data.candidates[0].content.parts[0].text;

    return {
      timestamp,
      description: description.trim(),
      success: true
    };

  } catch (error) {
    console.error(`Error analyzing frame at ${timestamp}s:`, error.message);
    return {
      timestamp,
      description: null,
      success: false,
      error: error.message
    };
  }
}

/**
 * Analyze all extracted frames
 * @param {array} frames - Array of frame objects with paths
 * @param {function} onProgress - Progress callback
 * @returns {Promise<array>} - Array of analysis results
 */
async function analyzeAllFrames(frames, onProgress) {
  const analyses = [];
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    
    if (onProgress) {
      onProgress(`Analyzing frame ${i + 1}/${frames.length} (${frame.timestamp.toFixed(1)}s)`, i + 1, frames.length);
    }

    const analysis = await analyzeFrameWithGemini(frame.path, frame.timestamp);
    
    if (analysis.success) {
      analyses.push(analysis);
    }

    // Small delay to avoid rate limiting
    if (i < frames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return analyses;
}

/**
 * Complete visual analysis pipeline
 * @param {string} videoPath - Path to video file
 * @param {object} options - Analysis options
 * @param {function} onProgress - Progress callback
 * @returns {Promise<object>} - Complete visual analysis
 */
export async function analyzeVideoVisuals(videoPath, options = {}, onProgress) {
  const {
    numFrames = 10, // Extract exactly 10 frames
    method = 'smart', // Use smart distribution
    cleanupFrames = true
  } = options;

  try {
    // Step 1: Extract frames
    if (onProgress) onProgress('Extracting video frames...');
    
    const frameResult = await extractFramesForAnalysis(videoPath, {
      numFrames,
      method
    });

    if (!frameResult.success) {
      throw new Error(`Frame extraction failed: ${frameResult.error}`);
    }

    console.log(`Extracted ${frameResult.frames_extracted} frames for analysis`);
    if (onProgress) onProgress(`Extracted ${frameResult.frames_extracted} frames for analysis`);

    // Step 2: Analyze frames with Gemini Vision
    if (onProgress) onProgress('Analyzing visual content with AI...');
    
    const analyses = await analyzeAllFrames(frameResult.frames, (progressMsg, currentFrame, totalFrames) => {
      if (onProgress) onProgress(progressMsg, currentFrame, totalFrames);
    });

    // Step 3: Cleanup frames if requested
    if (cleanupFrames && frameResult.output_folder) {
      try {
        await fs.rm(frameResult.output_folder, { recursive: true, force: true });
        console.log('Cleaned up frame files');
      } catch (err) {
        console.error('Failed to cleanup frames:', err);
      }
    }

    return {
      success: true,
      frames_analyzed: analyses.length,
      video_duration: frameResult.video_duration,
      analyses: analyses.filter(a => a.success),
      failed: analyses.filter(a => !a.success).length
    };

  } catch (error) {
    console.error('Visual analysis error:', error);
    throw error;
  }
}

/**
 * Format visual analyses for summary integration
 * @param {array} analyses - Array of frame analyses
 * @returns {string} - Formatted text for summary
 */
export function formatVisualContentForSummary(analyses) {
  if (!analyses || analyses.length === 0) {
    return '';
  }

  let formatted = '\n\n=== VISUAL CONTENT FROM VIDEO ===\n\n';
  
  analyses.forEach((analysis, index) => {
    const minutes = Math.floor(analysis.timestamp / 60);
    const seconds = Math.floor(analysis.timestamp % 60);
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    formatted += `[${timeStr}] ${analysis.description}\n\n`;
  });

  return formatted;
}

/**
 * Merge visual analysis with transcript for comprehensive summary
 * @param {string} transcript - Video transcript
 * @param {array} visualAnalyses - Visual content analyses
 * @returns {string} - Combined content for summary
 */
export function mergeVisualWithTranscript(transcript, visualAnalyses) {
  if (!visualAnalyses || visualAnalyses.length === 0) {
    return transcript;
  }

  const visualContent = formatVisualContentForSummary(visualAnalyses);
  
  return `${transcript}\n\n${visualContent}`;
}
