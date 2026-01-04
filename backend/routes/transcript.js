import express from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
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
    const { videoUrl, language = 'english', startTime, endTime } = req.body;
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

    let useSegmentRange = false;
    let segmentStartSeconds = null;
    let segmentEndSeconds = null;

    if (typeof startTime !== 'undefined' || typeof endTime !== 'undefined') {
      if (!startTime || !endTime) {
        console.error(`[${sessionId}] Invalid segment request: startTime or endTime missing`);
        return res.status(400).json({ error: "Both startTime and endTime are required when requesting a partial summary" });
      }

      segmentStartSeconds = parseTimeToSeconds(startTime);
      segmentEndSeconds = parseTimeToSeconds(endTime);

      if (segmentStartSeconds === null || segmentEndSeconds === null) {
        console.error(`[${sessionId}] Invalid segment request: could not parse times`, { startTime, endTime });
        return res.status(400).json({ error: "Invalid startTime or endTime format" });
      }

      if (segmentStartSeconds < 0 || segmentEndSeconds <= segmentStartSeconds) {
        console.error(`[${sessionId}] Invalid segment range: start=${segmentStartSeconds}, end=${segmentEndSeconds}`);
        return res.status(400).json({ error: "endTime must be greater than startTime and both must be non-negative" });
      }

      if (segmentEndSeconds > videoDurationSeconds + 1) {
        console.error(`[${sessionId}] Segment endTime beyond video duration: end=${segmentEndSeconds}, duration=${videoDurationSeconds}`);
        return res.status(400).json({ error: "endTime cannot be greater than video duration" });
      }

      useSegmentRange = true;
      console.log(`[${sessionId}] Segment summary requested: ${segmentStartSeconds}s to ${segmentEndSeconds}s`);
    }

    sendProgress(sessionId, "🚀 Initializing transcription process...", 5);

    const audioFile = path.join(TEMP_DIR, `audio_${sessionId}.wav`);
    const segmentAudioFile = path.join(TEMP_DIR, `audio_segment_${sessionId}.wav`);
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
    
    // If a specific time range is requested, trim audio to that segment
    let effectiveAudioFile = audioFile;

    if (useSegmentRange) {
      try {
        sendProgress(sessionId, "✂️ Trimming audio to selected time range...", 32);
        await createAudioSegment(audioFile, segmentAudioFile, segmentStartSeconds, segmentEndSeconds);
        effectiveAudioFile = segmentAudioFile;
        sendProgress(sessionId, "✅ Audio trimmed to selected range", 34);
      } catch (trimError) {
        console.error(`[${sessionId}] Failed to trim audio segment:`, trimError);
        // Fall back to using full audio file for analysis
        effectiveAudioFile = audioFile;
        sendProgress(sessionId, "⚠️ Using full audio as fallback (failed to trim segment)", 34);
      }
    }

    // Step 2: Analyze audio content (on effective audio: full or segment)
    sendProgress(sessionId, "🔍 Analyzing audio content...", 35);
    
    audioAnalysis = await detectSpeechInAudio(effectiveAudioFile);
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
        transcript = await transcribeWithLocalWhisper(effectiveAudioFile, (progressMsg, percent) => {
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

    let visualAnalysesForSummary = visualAnalyses;

    if (useSegmentRange && finalHasVisuals) {
      visualAnalysesForSummary = visualAnalyses.filter((analysis) => {
        if (typeof analysis.timestamp !== "number") {
          return false;
        }
        return analysis.timestamp >= segmentStartSeconds && analysis.timestamp <= segmentEndSeconds;
      });
    }

    const finalHasVisualsForSummary = visualAnalysesForSummary && visualAnalysesForSummary.length > 0;

    console.log(`[${sessionId}] Summary decision factors:`);
    console.log(`  - hasValidTranscript: ${hasValidTranscript}`);
    console.log(`  - transcriptionSkipped: ${transcriptionSkipped}`);
    console.log(`  - useVisualsForSummary: ${useVisualsForSummary}`);
    console.log(`  - visualAnalyses length: ${visualAnalyses.length}`);
    if (useSegmentRange) {
      console.log(`  - segmentStartSeconds: ${segmentStartSeconds}`);
      console.log(`  - segmentEndSeconds: ${segmentEndSeconds}`);
      console.log(`  - visualAnalysesForSummary length: ${visualAnalysesForSummary.length}`);
    }
    
    let summary;
    let summaryType = "transcript_only";
    let visualFramesAnalyzed = 0;
    
    if (hasValidTranscript && videoDurationSeconds < 1200) {
      summary = await generateEnhancedSummary(transcript, visualAnalysesForSummary, language);
      summaryType = "enhanced";
      visualFramesAnalyzed = visualAnalysesForSummary.length;
      sendProgress(sessionId, "✅ Summary complete!", 95);
    } else if (hasValidTranscript) {
      summary = await summarizeWithGemini(transcript, language);
      summaryType = "transcript_only";
      sendProgress(sessionId, "✅ Summary complete!", 95);
    } else if (finalHasVisualsForSummary) {
      summary = await generateVisualOnlySummary(visualAnalysesForSummary, language);
      summaryType = "visual_only";
      visualFramesAnalyzed = visualAnalysesForSummary.length;
      sendProgress(sessionId, "✅ Summary complete!", 95);
    } else {
      throw new Error('Unable to generate summary: No valid transcript or visual analysis available.');
    }

    // If only a specific timeframe was analyzed, make that explicit in the summary text
    if (useSegmentRange && summary) {
      const startLabel = formatSecondsForLabel(segmentStartSeconds);
      const endLabel = formatSecondsForLabel(segmentEndSeconds);
      const prefix = `In the selected timeframe (${startLabel} - ${endLabel}), the video explains the following:\n\n`;
      summary = prefix + summary;
    }
    
    // Clean up files
    try {
      if (fs.existsSync(audioFile)) {
        fs.unlinkSync(audioFile);
        console.log(`[${sessionId}] Cleaned up audio file`);
      }
      if (fs.existsSync(segmentAudioFile)) {
        fs.unlinkSync(segmentAudioFile);
        console.log(`[${sessionId}] Cleaned up segment audio file`);
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
      sessionId,
      durationSeconds: videoDurationSeconds
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

router.post("/segment-summary", verifyToken, async (req, res) => {
  try {
    const {
      transcript,
      videoDurationSeconds,
      startTime,
      endTime,
      language = "english"
    } = req.body;

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ error: "transcript is required" });
    }

    if (!videoDurationSeconds || typeof videoDurationSeconds !== "number" || videoDurationSeconds <= 0) {
      return res.status(400).json({ error: "videoDurationSeconds must be a positive number" });
    }

    const startSeconds = parseTimeToSeconds(startTime);
    const endSeconds = parseTimeToSeconds(endTime);

    if (startSeconds === null || endSeconds === null) {
      return res.status(400).json({ error: "Invalid startTime or endTime format" });
    }

    if (startSeconds < 0 || endSeconds <= startSeconds) {
      return res.status(400).json({ error: "endTime must be greater than startTime and both must be non-negative" });
    }

    if (endSeconds > videoDurationSeconds + 1) {
      return res.status(400).json({ error: "endTime cannot be greater than video duration" });
    }

    const segmentTranscript = sliceTranscriptByTime(
      transcript,
      videoDurationSeconds,
      startSeconds,
      endSeconds
    );

    if (!segmentTranscript || !segmentTranscript.trim()) {
      return res.status(400).json({ error: "No transcript content found for the selected time range" });
    }

    const segmentSummary = await summarizeWithGemini(segmentTranscript, language);

    res.json({
      segmentSummary,
      startTimeSeconds: startSeconds,
      endTimeSeconds: endSeconds
    });
  } catch (err) {
    console.error("[/transcript/segment-summary] Error:", err);
    res.status(500).json({
      error: "Failed to generate segment summary",
      details: err.message
    });
  }
});

router.post("/duration", verifyToken, async (req, res) => {
  try {
    const { videoUrl } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: "videoUrl is required" });
    }

    const videoDurationSeconds = await getVideoDuration(videoUrl);

    return res.json({ durationSeconds: videoDurationSeconds });
  } catch (err) {
    console.error("[/transcript/duration] Error:", err);
    return res.status(500).json({
      error: "Failed to get video duration",
      details: err.message
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

function parseTimeToSeconds(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return null;
    }
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const num = parseFloat(trimmed);
    return Number.isNaN(num) ? null : num;
  }

  const parts = trimmed.split(":").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) {
    return null;
  }

  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => Number.isNaN(n))) {
    return null;
  }

  let seconds = 0;
  if (nums.length === 3) {
    const [h, m, s] = nums;
    seconds = h * 3600 + m * 60 + s;
  } else if (nums.length === 2) {
    const [m, s] = nums;
    seconds = m * 60 + s;
  } else if (nums.length === 1) {
    seconds = nums[0];
  }

  return seconds;
}

function formatSecondsForLabel(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "unknown";
  }

  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  return `${minutes}:${ss}`;
}

function sliceTranscriptByTime(transcript, totalDurationSeconds, startSeconds, endSeconds) {
  if (!transcript || !transcript.trim()) {
    return "";
  }

  if (!totalDurationSeconds || totalDurationSeconds <= 0) {
    return transcript;
  }

  const sentences = transcript
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const count = sentences.length;
  if (!count) {
    return transcript;
  }

  const segmentDuration = totalDurationSeconds / count;
  const selected = [];

  for (let i = 0; i < count; i++) {
    const segStart = i * segmentDuration;
    const segEnd = (i + 1) * segmentDuration;

    if (segEnd > startSeconds && segStart < endSeconds) {
      selected.push(sentences[i]);
    }
  }

  if (!selected.length) {
    return "";
  }

  return `${selected.join(". ")}.`;
}

function createAudioSegment(inputPath, outputPath, startSeconds, endSeconds) {
  return new Promise((resolve, reject) => {
    try {
      if (!inputPath || !outputPath) {
        return reject(new Error("Input and output paths are required for audio segment creation"));
      }

      if (!fs.existsSync(inputPath)) {
        return reject(new Error(`Input audio file not found: ${inputPath}`));
      }

      if (typeof startSeconds !== "number" || typeof endSeconds !== "number" || Number.isNaN(startSeconds) || Number.isNaN(endSeconds)) {
        return reject(new Error("startSeconds and endSeconds must be valid numbers"));
      }

      if (endSeconds <= startSeconds) {
        return reject(new Error("endSeconds must be greater than startSeconds"));
      }

      const duration = endSeconds - startSeconds;

      const args = [
        "-y",
        "-i",
        inputPath,
        "-ss",
        String(startSeconds),
        "-t",
        String(duration),
        "-acodec",
        "copy",
        outputPath
      ];

      console.log("[ffmpeg] Creating audio segment:", args.join(" "));

      const ffmpeg = spawn("ffmpeg", args);
      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        console.log("[ffmpeg]", text.trim());
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        }

        if (!fs.existsSync(outputPath)) {
          return reject(new Error("Segment audio file was not created"));
        }

        resolve(outputPath);
      });

      ffmpeg.on("error", (err) => {
        reject(new Error(`Failed to start ffmpeg: ${err.message}`));
      });
    } catch (err) {
      reject(err);
    }
  });
}
