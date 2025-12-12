import express from "express";
import path from "path";
import fs from "fs";
import { TEMP_DIR, clearTempDirectory } from "../utils/tempManager.js";
import { extractAudioWithYtDlp } from "../services/audioExtractorYtDlp.js";
import { downloadVideo, downloadAudioAndVideo } from "../services/videoDownloader.js";
import { transcribeWithLocalWhisper } from "../services/localWhisper.js";
import { summarizeWithGemini } from "../services/geminiService.js";
import { extractEquationsFromVideo, mergeEquationsWithTranscript } from "../services/equationExtractor.js";
import { detectSpeechInAudio } from "../services/audioAnalyzer.js";
import { analyzeVideoVisuals } from "../services/visualAnalyzer.js";
import { generateEnhancedSummary } from "../services/enhancedSummarizer.js";
import { generateVisualOnlySummary } from "../services/visualOnlySummarizer.js";
import { getVideoDuration } from "../services/videoDurationChecker.js";

const router = express.Router();

// Ensure temp directory exists at startup
fs.mkdirSync(TEMP_DIR, { recursive: true });

/**
 * POST /api/analyze-video
 * Complete video analysis: transcription + equation extraction + summarization
 */
router.post("/", async (req, res) => {
  const sessionId = req.body.sessionId || Date.now().toString();
  clearTempDirectory(sessionId);
  
  try {
    const { 
      videoUrl, 
      language = 'english',
      includeEquations = false,
      equationOptions = {}
    } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: "videoUrl is required" });
    }

    console.log(`[${sessionId}] Starting complete video analysis`);
    console.log(`[${sessionId}] Include equations: ${includeEquations}`);

    const videoDurationSeconds = await getVideoDuration(videoUrl);
    const videoDurationMinutes = videoDurationSeconds / 60;
    const shouldUseVisualsForSummary = videoDurationMinutes < 20;
    console.log(`[${sessionId}] Video duration: ${videoDurationSeconds.toFixed(2)} seconds (${videoDurationMinutes.toFixed(2)} minutes)`);
    console.log(`[${sessionId}] Visual summary mode: ${shouldUseVisualsForSummary ? 'AUDIO + VISUAL (duration < 20 min)' : 'AUDIO-ONLY (duration >= 20 min)'}`);

    const audioFile = path.join(TEMP_DIR, `audio_${sessionId}.wav`);
    const videoFile = path.join(TEMP_DIR, `video_${sessionId}.mp4`);
    const requireVideoFile = includeEquations || shouldUseVisualsForSummary;

    // Step 1: Download media
    // If equations are requested, download both audio and video; otherwise audio only
    if (requireVideoFile) {
      sendProgress(sessionId, "📥 Downloading video and audio...", 5);
      
      try {
        await downloadAudioAndVideo(videoUrl, audioFile, videoFile, (progressMsg) => {
          sendProgress(sessionId, `📥 ${progressMsg}`, null);
        });
        
        sendProgress(sessionId, "✅ Download complete!", 30);
      } catch (downloadError) {
        console.error(`[${sessionId}] Optimized download failed, falling back to separate downloads:`, downloadError);
        
        // Fallback: Download audio only, then video separately
        sendProgress(sessionId, "📥 Downloading audio...", 10);
        await extractAudioWithYtDlp(videoUrl, audioFile, (progressMsg) => {
          sendProgress(sessionId, `🎵 ${progressMsg}`, null);
        });
        
        sendProgress(sessionId, "📥 Downloading video for frame analysis...", 20);
        await downloadVideo(videoUrl, videoFile, (progressMsg) => {
          sendProgress(sessionId, `📥 ${progressMsg}`, null);
        });
        
        sendProgress(sessionId, "✅ Downloads complete!", 30);
      }
    } else {
      // Audio only (faster for transcription-only requests)
      sendProgress(sessionId, "📥 Downloading video...", 5);
      sendProgress(sessionId, "🎵 Extracting audio...", 10);
      
      await extractAudioWithYtDlp(videoUrl, audioFile, (progressMsg) => {
        sendProgress(sessionId, `🎵 ${progressMsg}`, null);
      });
      
      sendProgress(sessionId, "✅ Audio extraction complete!", 30);
    }

    // Step 2: Analyze audio for speech content
    sendProgress(sessionId, "🔍 Analyzing audio content...", 35);
    
    const audioAnalysis = await detectSpeechInAudio(audioFile);
    console.log(`[${sessionId}] Audio analysis:`, audioAnalysis);
    
    let transcript = null;
    let transcriptionSkipped = false;
    let visualAnalyses = [];
    
    // Decide whether to transcribe based on speech detection
    if (audioAnalysis.success && audioAnalysis.has_speech === false && audioAnalysis.confidence > 0.6) {
      // High confidence that there's no speech - skip transcription
      console.log(`[${sessionId}] No speech detected (confidence: ${audioAnalysis.confidence}). Skipping transcription.`);
      sendProgress(sessionId, `🎵 No speech detected - cannot generate audio-based summary.`, 40);
      transcriptionSkipped = true;
      
    } else if (audioAnalysis.success && audioAnalysis.has_speech === true) {
      // Speech detected - proceed with transcription
      console.log(`[${sessionId}] Speech detected (confidence: ${audioAnalysis.confidence}). Proceeding with transcription.`);
      sendProgress(sessionId, "🎙️ Speech detected - transcribing audio...", 40);
      
      try {
        transcript = await transcribeWithLocalWhisper(audioFile, (progressMsg, percent) => {
          if (percent !== null) {
            const transcribePercent = 40 + Math.floor(percent * 0.25); // Map to 40-65%
            sendProgress(sessionId, `🎙️ ${progressMsg}`, transcribePercent);
          } else {
            sendProgress(sessionId, `🎙️ ${progressMsg}`, null);
          }
        }, language);
        
        sendProgress(sessionId, "✨ Transcription complete!", 65);
      } catch (transcribeError) {
        console.error(`[${sessionId}] Transcription failed:`, transcribeError.message);
        sendProgress(sessionId, "⚠️ Transcription failed - cannot generate summary from audio.", 65);
        transcriptionSkipped = true;
      }
      
    } else {
      // Uncertain - try transcription anyway but be prepared for failure
      console.log(`[${sessionId}] Uncertain audio content. Attempting transcription...`);
      sendProgress(sessionId, "🎙️ Transcribing audio...", 40);
      
      try {
        transcript = await transcribeWithLocalWhisper(audioFile, (progressMsg, percent) => {
          if (percent !== null) {
            const transcribePercent = 40 + Math.floor(percent * 0.25);
            sendProgress(sessionId, `🎙️ ${progressMsg}`, transcribePercent);
          } else {
            sendProgress(sessionId, `🎙️ ${progressMsg}`, null);
          }
        }, language);
        
        sendProgress(sessionId, "✨ Transcription complete!", 65);
      } catch (transcribeError) {
        console.error(`[${sessionId}] Transcription failed:`, transcribeError.message);
        sendProgress(sessionId, "⚠️ Transcription failed - cannot generate summary from audio.", 65);
        transcriptionSkipped = true;
      }
    }

    // Step 3: Extract equations (if requested)
    let equationData = null;
    let mergedTimeline = null;
    
    if (includeEquations) {
      sendProgress(sessionId, "📐 Extracting equations from video frames...", 70);
      
      try {
        // Verify video file exists (should have been downloaded in Step 1)
        if (!fs.existsSync(videoFile)) {
          console.warn(`[${sessionId}] Video file not found at ${videoFile}`);
          sendProgress(sessionId, "⚠️ Video file not available, skipping equation extraction", 75);
        } else {
          const {
            interval = 5,
            method = 'scene',
            cleanupFrames = true
          } = equationOptions;

          console.log(`[${sessionId}] Extracting equations with method: ${method}, interval: ${interval}s`);
          
          equationData = await extractEquationsFromVideo(videoFile, {
            interval,
            method,
            cleanupFrames
          });

          if (equationData.success) {
            sendProgress(sessionId, `✅ Found ${equationData.equations_found} equations`, 80);

            // Merge equations with transcript
            if (equationData.equations_found > 0) {
              sendProgress(sessionId, "🔗 Merging equations with transcript...", 82);
              
              mergedTimeline = await mergeEquationsWithTranscript(
                { results: equationData.equations },
                parseTranscriptForMerge(transcript),
                { timeWindow: 10 }
              );
              
              sendProgress(sessionId, "✅ Timeline created!", 85);
            } else {
              sendProgress(sessionId, "ℹ️ No equations detected in video", 85);
            }
          } else {
            console.error(`[${sessionId}] Equation extraction failed:`, equationData.error);
            sendProgress(sessionId, `⚠️ ${equationData.error}`, 85);
          }
        }
      } catch (eqError) {
        console.error(`[${sessionId}] Equation extraction error:`, eqError);
        sendProgress(sessionId, `⚠️ Equation extraction failed: ${eqError.message}`, null);
        // Continue with summarization even if equation extraction fails
      }
    }

    // Step 4: Generate summary (audio-only)
    sendProgress(sessionId, "🤖 Generating comprehensive summary...", 90);
    
    const hasValidTranscript = transcript && transcript.trim().length > 0;

    const useVisualsForSummary = (videoDurationSeconds < 1200) || !hasValidTranscript;
    const canUseVideoFile = fs.existsSync(videoFile);
    
    if (useVisualsForSummary) {
      try {
        if (!canUseVideoFile) {
          sendProgress(sessionId, "📥 Downloading video for visual analysis...", 70);
          await downloadVideo(videoUrl, videoFile, (progressMsg) => {
            sendProgress(sessionId, `📥 ${progressMsg}`, null);
          });
        }

        const frameCount = getSmartFrameCount(videoDurationSeconds);
        console.log(`[${sessionId}] Visual analysis enabled. Duration: ${videoDurationSeconds.toFixed(2)}s, frames: ${frameCount}`);
        
        const visualResult = await analyzeVideoVisuals(videoFile, {
          numFrames: frameCount,
          method: 'smart',
          cleanupFrames: true
        }, (progressMsg, currentFrame, totalFrames) => {
          sendProgress(sessionId, `🖼️ ${progressMsg}`, null);
        });

        if (visualResult && visualResult.success && Array.isArray(visualResult.analyses)) {
          visualAnalyses = visualResult.analyses;
          console.log(`[${sessionId}] Visual analysis complete. Frames analyzed: ${visualAnalyses.length}`);
        } else {
          console.log(`[${sessionId}] Visual analysis did not return results. Falling back to audio-only summary if available.`);
        }
      } catch (visualError) {
        console.error(`[${sessionId}] Visual analysis error:`, visualError);
      }
    }

    const finalHasVisuals = visualAnalyses && visualAnalyses.length > 0;

    console.log(`[${sessionId}] Summary generation decision:`);
    console.log(`  - Transcript available: ${!!transcript}, length: ${transcript?.length || 0}`);
    console.log(`  - Transcription skipped: ${transcriptionSkipped}`);
    console.log(`  - hasValidTranscript: ${hasValidTranscript}`);
    console.log(`  - useVisualsForSummary: ${useVisualsForSummary}`);
    console.log(`  - visualAnalyses length: ${visualAnalyses.length}`);

    let summary;

    if (hasValidTranscript && videoDurationSeconds < 1200) {
      console.log(`[${sessionId}] Generating ENHANCED summary (audio + visual)`);
      sendProgress(sessionId, "🤝 Generating enhanced audio+visual summary...", 92);
      summary = await generateEnhancedSummary(transcript, visualAnalyses, language);
      sendProgress(sessionId, "✅ Summary complete!", 95);
    } else if (hasValidTranscript) {
      console.log(`[${sessionId}] Generating AUDIO-ONLY summary (duration >= 20 min)`);
      sendProgress(sessionId, "🎙️ Generating summary from transcript only...", 92);
      summary = await summarizeWithGemini(transcript, language);
      sendProgress(sessionId, "✅ Summary complete!", 95);
    } else if (finalHasVisuals) {
      console.log(`[${sessionId}] No valid transcript. Generating VISUAL-ONLY summary.`);
      sendProgress(sessionId, "🖼️ Generating summary from visual content only...", 92);
      summary = await generateVisualOnlySummary(visualAnalyses, language);
      sendProgress(sessionId, "✅ Summary complete!", 95);
    } else {
      const errorMsg = 'Unable to generate summary: No valid transcript or visual analysis available.';
      throw new Error(errorMsg);
    }

    // Clean up files
    try {
      if (fs.existsSync(audioFile)) {
        fs.unlinkSync(audioFile);
      }
      if (fs.existsSync(videoFile)) {
        fs.unlinkSync(videoFile);
      }
    } catch (cleanupErr) {
      console.error(`[${sessionId}] Cleanup error:`, cleanupErr);
    }

    sendProgress(sessionId, "🎉 Analysis complete!", 100);

    // Close SSE connection
    if (global.progressSessions && global.progressSessions[sessionId]) {
      global.progressSessions[sessionId].end();
      delete global.progressSessions[sessionId];
    }

    // Prepare response
    const response = {
      summary,
      transcript: transcript || null,
      transcriptionSkipped,
      audioAnalysis: audioAnalysis.success ? {
        hasSpeech: audioAnalysis.has_speech,
        confidence: audioAnalysis.confidence,
        reasons: audioAnalysis.reasons
      } : null,
      language,
      sessionId
    };

    // Add equation data if available
    if (equationData && equationData.success) {
      response.equations = {
        total: equationData.equations_found,
        frames_analyzed: equationData.frames_extracted,
        data: equationData.equations
      };
    }

    // Add merged timeline if available
    if (mergedTimeline && mergedTimeline.success) {
      response.timeline = mergedTimeline.timeline;
    }

    res.json(response);

  } catch (err) {
    console.error(`[${sessionId}] Analysis error:`, err);
    
    sendProgress(sessionId, `❌ Error: ${err.message}`, null);
    
    // Close SSE connection
    if (global.progressSessions && global.progressSessions[sessionId]) {
      global.progressSessions[sessionId].end();
      delete global.progressSessions[sessionId];
    }
    
    res.status(500).json({
      error: "Video analysis failed",
      details: err.message,
      sessionId
    });
  }
});

/**
 * Helper function to send progress updates
 */
function sendProgress(sessionId, message, percent = null) {
  if (global.progressSessions && global.progressSessions[sessionId]) {
    const data = { message, percent };
    global.progressSessions[sessionId].write(`data: ${JSON.stringify(data)}\n\n`);
  }
  console.log(`[${sessionId}] ${message}${percent ? ` (${percent}%)` : ''}`);
}

/**
 * Helper function to parse transcript for merging
 * Converts plain text transcript to segments with timestamps
 */
function parseTranscriptForMerge(transcript) {
  // If transcript is already in segment format, return as is
  if (Array.isArray(transcript)) {
    return transcript;
  }

  // Otherwise, create simple segments
  // This is a basic implementation - can be enhanced with actual timestamps
  const sentences = transcript.split(/[.!?]+/).filter(s => s.trim());
  const avgDuration = 5; // Assume 5 seconds per sentence
  
  return sentences.map((text, index) => ({
    start: index * avgDuration,
    end: (index + 1) * avgDuration,
    text: text.trim()
  }));
}

function getSmartFrameCount(durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) {
    return 4;
  }
  if (durationSeconds < 120) {
    // Videos shorter than 2 minutes -> 1 frame (middle of video)
    return 1;
  }
  if (durationSeconds >= 120 && durationSeconds < 300) {
    // Videos between 2 and 5 minutes -> up to 3 frames at regular intervals
    return 3;
  }
  if (durationSeconds >= 300 && durationSeconds < 1200) {
    // Videos between 5 and 20 minutes -> up to 4 frames
    return 4;
  }
  return 4;
}

export default router;
