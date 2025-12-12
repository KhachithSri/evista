import express from "express";
import path from "path";
import fs from "fs";
import { TEMP_DIR, clearTempDirectory } from "../utils/tempManager.js";
import { extractAudioWithYtDlp } from "../services/audioExtractorYtDlp.js";
import { transcribeWithLocalWhisper } from "../services/localWhisper.js";
import { summarizeWithGemini } from "../services/geminiService.js";
import { detectSpeechInAudio } from "../services/audioAnalyzer.js";
import { verifyToken } from "../middleware/auth.js";
import { updateUserStats } from "../services/badgeService.js";
import Summary from "../models/Summary.js";
import { downloadVideo, downloadAudioAndVideo } from "../services/videoDownloader.js";
import { analyzeVideoVisuals } from "../services/visualAnalyzer.js";
import { generateEnhancedSummary } from "../services/enhancedSummarizer.js";
import { generateVisualOnlySummary } from "../services/visualOnlySummarizer.js";
import { getVideoDuration } from "../services/videoDurationChecker.js";

const router = express.Router();

// Ensure temp directory exists at startup
fs.mkdirSync(TEMP_DIR, { recursive: true });

// SSE endpoint for progress updates
router.get("/progress/:sessionId", (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const sessionId = req.params.sessionId;
  
  // Store the response object for this session
  if (!global.progressSessions) {
    global.progressSessions = {};
  }
  global.progressSessions[sessionId] = res;

  req.on('close', () => {
    delete global.progressSessions[sessionId];
  });
});

function sendProgress(sessionId, message, percent = null) {
  if (global.progressSessions && global.progressSessions[sessionId]) {
    const data = { message, percent };
    global.progressSessions[sessionId].write(`data: ${JSON.stringify(data)}\n\n`);
  }
  console.log(`[${sessionId}] ${message}${percent ? ` (${percent}%)` : ''}`);
}

router.post("/", verifyToken, async (req, res) => {
  const sessionId = req.body.sessionId || Date.now().toString();
  clearTempDirectory(sessionId);
  const userId = req.user?.userId;
  
  try {
    const { videoUrl, language = 'english' } = req.body;
    console.log(`[${sessionId}] Received transcription request`);
    console.log(`[${sessionId}] User ID:`, userId);
    console.log(`[${sessionId}] Video URL:`, videoUrl);
    
    if (!videoUrl) {
      console.error(`[${sessionId}] Error: No videoUrl provided`);
      return res.status(400).json({ error: "videoUrl is required" });
    }
    
    console.log(`[${sessionId}] Target language: ${language}`);

    console.log(`[${sessionId}] Starting analysis for:`, videoUrl);

    const videoDurationSeconds = await getVideoDuration(videoUrl);
    const videoDurationMinutes = videoDurationSeconds / 60;
    const shouldUseVisualsForSummary = videoDurationMinutes < 20;
    console.log(`[${sessionId}] Video duration: ${videoDurationSeconds.toFixed(2)} seconds (${videoDurationMinutes.toFixed(2)} minutes)`);
    console.log(`[${sessionId}] Visual summary mode: ${shouldUseVisualsForSummary ? 'AUDIO + VISUAL (duration < 20 min)' : 'AUDIO-ONLY (duration >= 20 min)'}`);

    sendProgress(sessionId, "🚀 Initializing transcription process...", 5);

    const audioFile = path.join(TEMP_DIR, `audio_${sessionId}.wav`);
    const videoFile = path.join(TEMP_DIR, `video_${sessionId}.mp4`);
    
    // Step 1: Download media
    if (shouldUseVisualsForSummary) {
      sendProgress(sessionId, "📥 Downloading video and audio...", 10);
      try {
        await downloadAudioAndVideo(videoUrl, audioFile, videoFile, (progressMsg) => {
          sendProgress(sessionId, `📥 ${progressMsg}`, null);
        });
        sendProgress(sessionId, "✅ Download complete!", 30);
      } catch (downloadError) {
        console.error(`[${sessionId}] Optimized download failed, falling back to audio-only:`, downloadError);
        sendProgress(sessionId, "📥 Downloading audio...", 10);
        await extractAudioWithYtDlp(videoUrl, audioFile, (progressMsg) => {
          sendProgress(sessionId, `🎵 ${progressMsg}`, null);
        });
        sendProgress(sessionId, "✅ Audio extraction complete!", 30);
      }
    } else {
      // Step 1: Download audio only (audio-first pipeline)
      sendProgress(sessionId, "📥 Downloading audio...", 10);
      await extractAudioWithYtDlp(videoUrl, audioFile, (progressMsg) => {
        sendProgress(sessionId, `🎵 ${progressMsg}`, null);
      });
      sendProgress(sessionId, "✅ Audio extraction complete!", 30);
    }

    let transcript = null;
    let transcriptionSkipped = false;
    let audioAnalysis = { success: false, uncertain: true }; // Default for response
    let visualAnalyses = [];
    
    // Step 2: Analyze audio content
    sendProgress(sessionId, "🔍 Analyzing audio content...", 35);
    
    audioAnalysis = await detectSpeechInAudio(audioFile);
    console.log(`[${sessionId}] Audio analysis:`, audioAnalysis);
    
    // Step 3: Transcription with smart speech detection
    if (audioAnalysis.success && audioAnalysis.has_speech === false && audioAnalysis.confidence > 0.6) {
      console.log(`[${sessionId}] No speech detected (confidence: ${audioAnalysis.confidence}). Skipping transcription.`);
      sendProgress(sessionId, `🎵 No speech detected - cannot generate audio-based summary.`, 40);
      transcriptionSkipped = true;
      
    } else {
      sendProgress(sessionId, "🚀 Loading ultra-fast Whisper model (10x faster)...", 45);
      sendProgress(sessionId, "⚡ Starting lightning-fast transcription...", 50);
      
      try {
        transcript = await transcribeWithLocalWhisper(audioFile, (progressMsg, percent) => {
          if (percent !== null) {
            const transcribePercent = 50 + Math.floor(percent * 0.35); // Map 0-100% to 50-85%
            sendProgress(sessionId, `🎙️ ${progressMsg}`, transcribePercent);
          } else {
            sendProgress(sessionId, `🎙️ ${progressMsg}`, null);
          }
        }, language);
        
        console.log(`[${sessionId}] Transcript received:`, transcript ? `${transcript.substring(0, 100)}...` : 'EMPTY OR NULL');
        console.log(`[${sessionId}] Transcript length: ${transcript?.length || 0} characters`);
        
        sendProgress(sessionId, "✨ Transcription complete!", 85);
      } catch (transcribeError) {
        console.error(`[${sessionId}] Transcription failed:`, transcribeError.message);
        sendProgress(sessionId, "⚠️ Transcription failed - cannot generate summary.", 85);
        transcriptionSkipped = true;
      }
    }

    // Step 5: Generate summary based on available data
    sendProgress(sessionId, "🤖 Generating comprehensive summary...", 90);
    
    const hasValidTranscript = transcript && transcript.trim().length > 0;

    const useVisualsForSummary = shouldUseVisualsForSummary;
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
        const visualResult = await analyzeVideoVisuals(videoFile, {
          numFrames: frameCount,
          method: 'smart',
          cleanupFrames: true
        }, (progressMsg, currentFrame, totalFrames) => {
          sendProgress(sessionId, `🖼️ ${progressMsg}`, null);
        });

        if (visualResult && visualResult.success && Array.isArray(visualResult.analyses)) {
          visualAnalyses = visualResult.analyses;
        }
      } catch (visualError) {
        console.error(`[${sessionId}] Visual analysis error:`, visualError);
      }
    }

    const finalHasVisuals = visualAnalyses && visualAnalyses.length > 0;

    console.log(`[${sessionId}] Summary decision factors:`);
    console.log(`  - hasValidTranscript: ${hasValidTranscript}`);
    console.log(`  - transcriptionSkipped: ${transcriptionSkipped}`);
    console.log(`  - useVisualsForSummary: ${useVisualsForSummary}`);
    console.log(`  - visualAnalyses length: ${visualAnalyses.length}`);
    
    let summary;
    let summaryType = "transcript_only";
    let visualFramesAnalyzed = 0;
    
    if (hasValidTranscript && videoDurationSeconds < 1200) {
      summary = await generateEnhancedSummary(transcript, visualAnalyses, language);
      summaryType = "enhanced";
      visualFramesAnalyzed = visualAnalyses.length;
      sendProgress(sessionId, "✅ Summary complete!", 95);
    } else if (hasValidTranscript) {
      summary = await summarizeWithGemini(transcript, language);
      summaryType = "transcript_only";
      sendProgress(sessionId, "✅ Summary complete!", 95);
    } else if (finalHasVisuals) {
      summary = await generateVisualOnlySummary(visualAnalyses, language);
      summaryType = "visual_only";
      visualFramesAnalyzed = visualAnalyses.length;
      sendProgress(sessionId, "✅ Summary complete!", 95);
    } else {
      throw new Error('Unable to generate summary: No valid transcript or visual analysis available.');
    }
    
    // Clean up files
    try {
      if (fs.existsSync(audioFile)) {
        fs.unlinkSync(audioFile);
        console.log(`[${sessionId}] Cleaned up audio file`);
      }
      if (fs.existsSync(videoFile)) {
        fs.unlinkSync(videoFile);
        console.log(`[${sessionId}] Cleaned up video file`);
      }
    } catch (cleanupErr) {
      console.error(`[${sessionId}] Failed to cleanup files:`, cleanupErr);
    }
    
    sendProgress(sessionId, "🎉 Process complete!", 100);

    // Close SSE connection
    if (global.progressSessions && global.progressSessions[sessionId]) {
      global.progressSessions[sessionId].end();
      delete global.progressSessions[sessionId];
    }

    console.log(`[${sessionId}] Analysis completed successfully`);
    console.log(`[${sessionId}] Summary length:`, summary ? summary.length : 0);
    
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

    // Save summary to database if authenticated
    if (userId) {
      try {
        const summaryDoc = new Summary({
          user: userId,
          video: null, // We don't have a video document reference, so leave null
          language: language,
          summaryType: summaryType,
          content: summary,
          transcript: transcript || null,
          durationSeconds: videoDurationSeconds,
          metadata: {
            videoTitle: req.body.videoTitle || 'Untitled Video',
            channelTitle: req.body.channelTitle || 'Unknown Channel',
            videoUrl: videoUrl,
            visualFramesAnalyzed: visualFramesAnalyzed,
            transcriptionSkipped: transcriptionSkipped
          }
        });
        
        await summaryDoc.save();
        console.log(`[${sessionId}] Saved summary to database - ID: ${summaryDoc._id}`);
        response.summaryId = summaryDoc._id;
        
        // Update user stats
        await updateUserStats(userId, { "stats.summariesGenerated": 1 });
        console.log(`[${sessionId}] Updated user stats - summary generated`);
      } catch (dbError) {
        console.error(`[${sessionId}] Failed to save summary to database:`, dbError);
        // Don't fail the response if database save fails
      }
    }
    
    res.json(response);
    
  } catch (err) {
    console.error(`[${sessionId}] Transcription error:`, err);
    
    sendProgress(sessionId, `Error: ${err.message}`, null);
    
    // Close SSE connection
    if (global.progressSessions && global.progressSessions[sessionId]) {
      global.progressSessions[sessionId].end();
      delete global.progressSessions[sessionId];
    }
    
    res.status(500).json({ 
      error: "Transcription failed", 
      details: err.message,
      sessionId 
    });
  }
});

export default router;

function getSmartFrameCount(durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) {
    return 4;
  }
  if (durationSeconds < 120) {
    return 1;
  }
  if (durationSeconds >= 120 && durationSeconds < 300) {
    return 3;
  }
  if (durationSeconds >= 300 && durationSeconds < 1200) {
    return 4;
  }
  return 4;
}
