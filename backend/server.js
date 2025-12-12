import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDatabase from "./config/database.js";
import youtubeRouter from "./routes/youtube.js";
import vimeoRouter from "./routes/vimeo.js";
import transcriptRouter from "./routes/transcript.js";
import quizRouter from "./routes/quiz.js";
import searchRouter from "./routes/search.js";
import flashcardRouter from "./routes/flashcard.js";
import chatRouter from "./routes/chat.js";
import translateRouter from "./routes/translate.js";
import equationsRouter from "./routes/equations.js";
import analyzeRouter from "./routes/analyze.js";
import authRouter from "./routes/auth.js";
import userRouter from "./routes/user.js";
import { initializeBadges } from "./services/badgeService.js";

dotenv.config();
await connectDatabase();
await initializeBadges();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for large text translations

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Backend is running",
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/user", userRouter);
app.use("/api/search", searchRouter);
app.use("/api/youtube", youtubeRouter);
app.use("/api/vimeo", vimeoRouter);
app.use("/api/transcript", transcriptRouter);
app.use("/api/quiz", quizRouter);
app.use("/api/flashcard", flashcardRouter);
app.use("/api/chat", chatRouter);
app.use("/api/translate", translateRouter);
app.use("/api/equations", equationsRouter);
app.use("/api/analyze-video", analyzeRouter);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

// Increase server timeout for long video processing (30 minutes)
server.timeout = 1800000; // 30 minutes in milliseconds
server.keepAliveTimeout = 1800000;
server.headersTimeout = 1810000; // Slightly higher than keepAliveTimeout
