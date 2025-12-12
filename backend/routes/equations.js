import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import {
  extractFrames,
  extractEquations,
  extractEquationsFromVideo,
  mergeEquationsWithTranscript
} from "../services/equationExtractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * POST /api/equations/extract-from-video
 * Extract equations from a video file
 */
router.post("/extract-from-video", async (req, res) => {
  try {
    const { videoPath, interval = 5, method = "interval" } = req.body;

    if (!videoPath) {
      return res.status(400).json({ error: "Video path is required" });
    }

    console.log(`Extracting equations from video: ${videoPath}`);

    const result = await extractEquationsFromVideo(videoPath, {
      interval,
      method,
      cleanupFrames: true
    });

    res.json(result);

  } catch (error) {
    console.error("Error extracting equations from video:", error);
    res.status(500).json({
      error: "Failed to extract equations from video",
      details: error.message
    });
  }
});

/**
 * POST /api/equations/extract-from-frames
 * Extract equations from already extracted frames
 */
router.post("/extract-from-frames", async (req, res) => {
  try {
    const { framesFolder } = req.body;

    if (!framesFolder) {
      return res.status(400).json({ error: "Frames folder path is required" });
    }

    console.log(`Extracting equations from frames in: ${framesFolder}`);

    const result = await extractEquations(framesFolder);

    res.json(result);

  } catch (error) {
    console.error("Error extracting equations from frames:", error);
    res.status(500).json({
      error: "Failed to extract equations from frames",
      details: error.message
    });
  }
});

/**
 * POST /api/equations/extract-frames
 * Extract frames from video without equation detection
 */
router.post("/extract-frames", async (req, res) => {
  try {
    const { videoPath, interval = 5, method = "interval", outputFolder } = req.body;

    if (!videoPath) {
      return res.status(400).json({ error: "Video path is required" });
    }

    const output = outputFolder || path.join(__dirname, "../temp", `frames_${Date.now()}`);

    console.log(`Extracting frames from: ${videoPath}`);

    const result = await extractFrames(videoPath, output, { interval, method });

    res.json(result);

  } catch (error) {
    console.error("Error extracting frames:", error);
    res.status(500).json({
      error: "Failed to extract frames",
      details: error.message
    });
  }
});

/**
 * POST /api/equations/merge-with-transcript
 * Merge extracted equations with video transcript
 */
router.post("/merge-with-transcript", async (req, res) => {
  try {
    const { equations, transcript, timeWindow = 10 } = req.body;

    if (!equations) {
      return res.status(400).json({ error: "Equations data is required" });
    }

    if (!transcript) {
      return res.status(400).json({ error: "Transcript data is required" });
    }

    console.log("Merging equations with transcript...");

    const result = await mergeEquationsWithTranscript(equations, transcript, { timeWindow });

    res.json(result);

  } catch (error) {
    console.error("Error merging equations with transcript:", error);
    res.status(500).json({
      error: "Failed to merge equations with transcript",
      details: error.message
    });
  }
});

/**
 * POST /api/equations/full-pipeline
 * Complete pipeline: Extract frames, equations, and merge with transcript
 */
router.post("/full-pipeline", async (req, res) => {
  try {
    const {
      videoPath,
      transcript,
      interval = 5,
      method = "interval",
      timeWindow = 10
    } = req.body;

    if (!videoPath) {
      return res.status(400).json({ error: "Video path is required" });
    }

    console.log("Starting full equation extraction pipeline...");

    // Step 1: Extract equations from video
    const equationResult = await extractEquationsFromVideo(videoPath, {
      interval,
      method,
      cleanupFrames: true
    });

    if (!equationResult.success) {
      throw new Error("Failed to extract equations from video");
    }

    // Step 2: Merge with transcript if provided
    let finalResult = equationResult;

    if (transcript) {
      console.log("Merging with transcript...");
      const mergedResult = await mergeEquationsWithTranscript(
        { results: equationResult.equations },
        transcript,
        { timeWindow }
      );

      finalResult = {
        ...equationResult,
        merged_timeline: mergedResult
      };
    }

    res.json(finalResult);

  } catch (error) {
    console.error("Error in full pipeline:", error);
    res.status(500).json({
      error: "Failed to complete equation extraction pipeline",
      details: error.message
    });
  }
});

/**
 * GET /api/equations/status
 * Check if equation extraction dependencies are installed
 */
router.get("/status", async (req, res) => {
  try {
    const { spawn } = await import("child_process");
    
    // Check Python
    const checkPython = () => new Promise((resolve) => {
      const proc = spawn("py", ["-3.10", "--version"]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });

    // Check OpenCV
    const checkOpenCV = () => new Promise((resolve) => {
      const proc = spawn("py", ["-3.10", "-c", "import cv2; print(cv2.__version__)"]);
      let version = "";
      proc.stdout.on("data", (data) => { version = data.toString().trim(); });
      proc.on("close", (code) => resolve(code === 0 ? version : false));
      proc.on("error", () => resolve(false));
    });

    // Check Pix2TeX
    const checkPix2TeX = () => new Promise((resolve) => {
      const proc = spawn("py", ["-3.10", "-c", "import pix2tex; print('installed')"]);
      proc.on("close", (code) => resolve(code === 0));
      proc.on("error", () => resolve(false));
    });

    const [pythonOk, opencvVersion, pix2texOk] = await Promise.all([
      checkPython(),
      checkOpenCV(),
      checkPix2TeX()
    ]);

    res.json({
      python: pythonOk,
      opencv: opencvVersion || false,
      pix2tex: pix2texOk,
      ready: pythonOk && opencvVersion && pix2texOk,
      message: pythonOk && opencvVersion && pix2texOk
        ? "All dependencies installed"
        : "Some dependencies missing. Run: pip install -r requirements.txt"
    });

  } catch (error) {
    res.status(500).json({
      error: "Failed to check status",
      details: error.message
    });
  }
});

export default router;
