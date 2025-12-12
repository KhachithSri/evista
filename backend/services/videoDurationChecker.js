import { spawn } from "child_process";

/**
 * Get video duration using yt-dlp
 * @param {string} videoUrl - YouTube video URL
 * @returns {Promise<number>} - Duration in seconds
 */
export async function getVideoDuration(videoUrl) {
  return new Promise((resolve, reject) => {
    console.log(`Getting video duration for: ${videoUrl}`);
    
    // Use yt-dlp to get video info without downloading
    const ytDlpArgs = [
      "-3.10",
      "-m", "yt_dlp",
      "--get-duration",
      "--no-playlist",
      videoUrl
    ];

    const ytDlpProcess = spawn("py", ytDlpArgs);
    let outputData = "";
    let errorData = "";

    ytDlpProcess.stdout.on("data", (data) => {
      outputData += data.toString();
    });

    ytDlpProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    ytDlpProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Failed to get video duration:", errorData);
        // Default to allowing visual analysis if we can't determine duration
        resolve(600); // 10 minutes default
        return;
      }

      try {
        const durationStr = outputData.trim();
        console.log(`Raw duration string: "${durationStr}"`);
        
        // Parse duration string (format: HH:MM:SS or MM:SS or SS)
        const durationSeconds = parseDurationString(durationStr);
        console.log(`Parsed duration: ${durationSeconds} seconds (${Math.floor(durationSeconds/60)} minutes)`);
        
        resolve(durationSeconds);
      } catch (error) {
        console.error("Failed to parse duration:", error);
        // Default to allowing visual analysis if parsing fails
        resolve(600); // 10 minutes default
      }
    });

    ytDlpProcess.on("error", (error) => {
      console.error("Failed to start yt-dlp for duration check:", error);
      // Default to allowing visual analysis if command fails
      resolve(600); // 10 minutes default
    });
  });
}

/**
 * Parse duration string to seconds
 * @param {string} durationStr - Duration in format HH:MM:SS, MM:SS, or SS
 * @returns {number} - Duration in seconds
 */
function parseDurationString(durationStr) {
  const parts = durationStr.split(':').map(part => parseInt(part, 10));
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 1) {
    // SS
    return parts[0];
  } else {
    throw new Error(`Invalid duration format: ${durationStr}`);
  }
}
