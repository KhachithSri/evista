import { spawn } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Extract audio from YouTube video using yt-dlp
 * @param {string} videoUrl - YouTube video URL
 * @param {string} outputFile - Output audio file path
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<string>} - Path to extracted audio file
 */
export async function extractAudioWithYtDlp(videoUrl, outputFile = "audio.wav", onProgress) {
  return new Promise((resolve, reject) => {
    const outputPath = path.resolve(outputFile);
    const tempOutput = outputPath.replace(".wav", ".temp");
    const customFfmpegPath = process.env.FFMPEG_PATH?.trim();
    const ffmpegLocation = customFfmpegPath
      ? (fs.existsSync(customFfmpegPath) && fs.lstatSync(customFfmpegPath).isFile()
        ? path.dirname(customFfmpegPath)
        : customFfmpegPath)
      : null;

    if (onProgress) onProgress("Starting audio extraction with yt-dlp...");

    // yt-dlp command to extract audio - OPTIMIZED FOR SPEED
    const ytDlpArgs = [
      videoUrl,
      "-f", "worstaudio/bestaudio",  // Use worst audio quality for faster download
      "--extract-audio",
      "--audio-format", "wav",
      "--audio-quality", "9",  // Lower quality = faster processing (9 is lowest)
      "--postprocessor-args", "ffmpeg:-ac 1 -ar 16000",  // Mono, 16kHz for faster processing
      "-o", tempOutput,
      "--no-playlist",
      "--quiet",
      "--progress",
      "--no-check-certificates",  // Skip certificate checks for speed
      "--concurrent-fragments", "4"  // Download multiple fragments in parallel
    ];

    if (ffmpegLocation) {
      ytDlpArgs.push("--ffmpeg-location", ffmpegLocation);
      console.log(`[yt-dlp] Using custom FFmpeg location: ${ffmpegLocation}`);
    }

    console.log(`Extracting audio: py -3.10 -m yt_dlp ${ytDlpArgs.join(" ")}`);

    const ytDlpProcess = spawn("py", ["-3.10", "-m", "yt_dlp", ...ytDlpArgs]);

    let errorBuffer = "";

    ytDlpProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`[yt-dlp] ${output}`);
      
      // Parse progress if available
      if (output.includes("%")) {
        const match = output.match(/(\d+\.?\d*)%/);
        if (match && onProgress) {
          onProgress(`Downloading: ${match[1]}%`);
        }
      }
    });

    ytDlpProcess.stderr.on("data", (data) => {
      const output = data.toString();
      errorBuffer += output;
      console.log(`[yt-dlp] ${output}`);
      
      // yt-dlp outputs progress to stderr
      if (output.includes("%")) {
        const match = output.match(/(\d+\.?\d*)%/);
        if (match && onProgress) {
          onProgress(`Downloading: ${match[1]}%`);
        }
      }
    });

    ytDlpProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed with code ${code}: ${errorBuffer}`));
        return;
      }

      // yt-dlp adds .wav extension automatically
      const actualOutput = tempOutput + ".wav";
      
      // Check if file exists and rename it
      if (fs.existsSync(actualOutput)) {
        fs.renameSync(actualOutput, outputPath);
        if (onProgress) onProgress("Audio extraction complete");
        resolve(outputPath);
      } else if (fs.existsSync(tempOutput)) {
        fs.renameSync(tempOutput, outputPath);
        if (onProgress) onProgress("Audio extraction complete");
        resolve(outputPath);
      } else {
        reject(new Error("Audio file not found after extraction"));
      }
    });

    ytDlpProcess.on("error", (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}. Make sure yt-dlp is installed.`));
    });
  });
}
