import express from "express";
import multer from "multer";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import OpenAI from "openai";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: openaiApiKey });

router.post("/", upload.single("audio"), async (req, res) => {
  try {
    if (!openaiApiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const tmpFilePath = path.join(
      os.tmpdir(),
      `voice-${Date.now()}-${req.file.originalname || "audio.webm"}`
    );

    await fs.promises.writeFile(tmpFilePath, req.file.buffer);

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tmpFilePath),
        model: "whisper-1",
      });

      return res.json({ text: transcription.text || "" });
    } finally {
      fs.promises.unlink(tmpFilePath).catch(() => {});
    }
  } catch (error) {
    console.error("Voice search transcription error:", error);
    return res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

export default router;
