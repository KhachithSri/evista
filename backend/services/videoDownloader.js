import { spawn } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Download video file from YouTube using yt-dlp
 * @param {string} videoUrl - YouTube video URL
 * @param {string} outputFile - Output video file path
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<string>} - Path to downloaded video file
 */
export async function downloadVideo(videoUrl, outputFile = "video.mp4", onProgress) {
  return new Promise((resolve, reject) => {
    const outputPath = path.resolve(outputFile);
    const tempOutput = outputPath.replace(".mp4", ".temp.mp4");

    if (onProgress) onProgress("Starting video download with yt-dlp...");

    // yt-dlp command to download video
    // Using best quality MP4 format for compatibility
    const ytDlpArgs = [
      videoUrl,
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "-o", tempOutput,
      "--no-playlist",
      "--quiet",
      "--progress",
      "--newline"  // Force newline for better progress parsing
    ];

    console.log(`Downloading video: py -3.10 -m yt_dlp ${ytDlpArgs.join(" ")}`);

    const ytDlpProcess = spawn("py", ["-3.10", "-m", "yt_dlp", ...ytDlpArgs]);

    let errorBuffer = "";

    ytDlpProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`[yt-dlp video] ${output}`);
      
      // Parse progress if available
      if (output.includes("%")) {
        const match = output.match(/(\d+\.?\d*)%/);
        if (match && onProgress) {
          onProgress(`Downloading video: ${match[1]}%`);
        }
      }
    });

    ytDlpProcess.stderr.on("data", (data) => {
      const output = data.toString();
      errorBuffer += output;
      console.log(`[yt-dlp video] ${output}`);
      
      // yt-dlp outputs progress to stderr
      if (output.includes("%")) {
        const match = output.match(/(\d+\.?\d*)%/);
        if (match && onProgress) {
          onProgress(`Downloading video: ${match[1]}%`);
        }
      }
    });

    ytDlpProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp video download failed with code ${code}: ${errorBuffer}`));
        return;
      }

      // Check if file exists and rename it
      if (fs.existsSync(tempOutput)) {
        fs.renameSync(tempOutput, outputPath);
        if (onProgress) onProgress("Video download complete");
        resolve(outputPath);
      } else {
        // Sometimes yt-dlp doesn't add .temp
        const possibleFiles = [
          outputPath,
          tempOutput.replace(".temp.mp4", ".mp4"),
          tempOutput.replace(".temp", "")
        ];
        
        let foundFile = null;
        for (const file of possibleFiles) {
          if (fs.existsSync(file)) {
            foundFile = file;
            break;
          }
        }
        
        if (foundFile) {
          if (foundFile !== outputPath) {
            fs.renameSync(foundFile, outputPath);
          }
          if (onProgress) onProgress("Video download complete");
          resolve(outputPath);
        } else {
          reject(new Error("Video file not found after download"));
        }
      }
    });

    ytDlpProcess.on("error", (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}. Make sure yt-dlp is installed.`));
    });
  });
}

/**
 * Download both audio and video in a single optimized call
 * @param {string} videoUrl - YouTube video URL
 * @param {string} audioFile - Output audio file path
 * @param {string} videoFile - Output video file path
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<{audio: string, video: string}>} - Paths to downloaded files
 */
export async function downloadAudioAndVideo(videoUrl, audioFile, videoFile, onProgress) {
  return new Promise((resolve, reject) => {
    const audioPath = path.resolve(audioFile);
    const videoPath = path.resolve(videoFile);
    const tempAudio = audioPath.replace(".wav", ".temp");
    const tempVideo = videoPath.replace(".mp4", ".temp.mp4");

    if (onProgress) onProgress("Starting audio and video download...");

    // Download video first (includes audio)
    const ytDlpArgs = [
      videoUrl,
      "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
      "--merge-output-format", "mp4",
      "-o", tempVideo,
      "--no-playlist",
      "--quiet",
      "--progress",
      "--newline"
    ];

    console.log(`Downloading audio+video: py -3.10 -m yt_dlp ${ytDlpArgs.join(" ")}`);

    const ytDlpProcess = spawn("py", ["-3.10", "-m", "yt_dlp", ...ytDlpArgs]);
    let errorBuffer = "";

    ytDlpProcess.stdout.on("data", (data) => {
      const output = data.toString();
      console.log(`[yt-dlp] ${output}`);
      
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
      
      if (output.includes("%")) {
        const match = output.match(/(\d+\.?\d*)%/);
        if (match && onProgress) {
          onProgress(`Downloading: ${match[1]}%`);
        }
      }
    });

    ytDlpProcess.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`Download failed with code ${code}: ${errorBuffer}`));
        return;
      }

      try {
        // Rename video file
        const actualVideoOutput = fs.existsSync(tempVideo) ? tempVideo : 
                                  fs.existsSync(tempVideo.replace(".temp.mp4", ".mp4")) ? 
                                  tempVideo.replace(".temp.mp4", ".mp4") : null;
        
        if (!actualVideoOutput) {
          reject(new Error("Video file not found after download"));
          return;
        }
        
        if (actualVideoOutput !== videoPath) {
          fs.renameSync(actualVideoOutput, videoPath);
        }
        
        if (onProgress) onProgress("Extracting audio from video...");
        
        // Extract audio from video using ffmpeg
        const { spawn } = await import("child_process");
        const ffmpegArgs = [
          "-i", videoPath,
          "-vn",  // No video
          "-acodec", "pcm_s16le",  // WAV codec
          "-ar", "16000",  // 16kHz sample rate (good for Whisper)
          "-ac", "1",  // Mono
          tempAudio,
          "-y"  // Overwrite
        ];
        
        const ffmpegProcess = spawn("ffmpeg", ffmpegArgs);
        let ffmpegError = "";
        
        ffmpegProcess.stderr.on("data", (data) => {
          ffmpegError += data.toString();
        });
        
        ffmpegProcess.on("close", (ffmpegCode) => {
          if (ffmpegCode !== 0) {
            reject(new Error(`Audio extraction failed: ${ffmpegError}`));
            return;
          }
          
          // Rename audio file
          if (fs.existsSync(tempAudio)) {
            fs.renameSync(tempAudio, audioPath);
          }
          
          if (onProgress) onProgress("Download and extraction complete!");
          
          resolve({
            audio: audioPath,
            video: videoPath
          });
        });
        
        ffmpegProcess.on("error", (err) => {
          reject(new Error(`FFmpeg not found: ${err.message}. Make sure FFmpeg is installed.`));
        });
        
      } catch (err) {
        reject(err);
      }
    });

    ytDlpProcess.on("error", (err) => {
      reject(new Error(`Failed to start yt-dlp: ${err.message}`));
    });
  });
}
