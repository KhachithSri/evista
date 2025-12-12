import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transcribe audio using local Whisper large model
 * @param {string} audioFilePath - Path to the audio file
 * @param {Function} progressCallback - Optional callback for progress updates (message, percent)
 * @param {string} language - Target language for transcription (tamil, telugu, kannada, hindi, english)
 * @returns {Promise<string>} - Transcribed text
 */
export async function transcribeWithLocalWhisper(audioFilePath, progressCallback = null, language = 'english') {
  return new Promise((resolve, reject) => {
    // ONLY allow these 5 languages - reject all others
    const SUPPORTED_LANGUAGES = ['tamil', 'telugu', 'kannada', 'hindi', 'english'];
    
    if (!SUPPORTED_LANGUAGES.includes(language.toLowerCase())) {
      return reject(new Error(
        `Unsupported language: '${language}'. Only Tamil, Telugu, Kannada, Hindi, and English are supported for transcription.`
      ));
    }
    
    // Check if audio file exists
    if (!fs.existsSync(audioFilePath)) {
      return reject(new Error(`Audio file not found: ${audioFilePath}`));
    }

    const pythonScript = path.join(__dirname, "whisper_service_simple.py");
    const absoluteAudioPath = path.resolve(audioFilePath);

    console.log(`Starting FAST Whisper transcription for: ${absoluteAudioPath}`);
    console.log(`Transcription language: ${language}`);

    // Spawn Python process with language parameter
    const pythonProcess = spawn("py", ["-3.10", pythonScript, absoluteAudioPath, language]);

    let outputBuffer = "";
    let errorBuffer = "";

    pythonProcess.stdout.on("data", (data) => {
      const output = data.toString();
      outputBuffer += output;
      
      // Try to parse each line as JSON for progress updates
      const lines = output.split("\n").filter(line => line.trim());
      lines.forEach(line => {
        try {
          const parsed = JSON.parse(line);
          console.log(`[Whisper] ${parsed.status}: ${parsed.message}`);
          
          // Send progress updates to callback
          if (progressCallback && parsed.status === "progress") {
            progressCallback(parsed.message, parsed.percent || null);
          } else if (progressCallback && parsed.status === "loading") {
            progressCallback(parsed.message, null);
          } else if (progressCallback && parsed.status === "transcribing") {
            progressCallback(parsed.message, null);
          }
          
          if (parsed.status === "complete" && parsed.transcript) {
            resolve(parsed.transcript);
          } else if (parsed.status === "error") {
            reject(new Error(parsed.message));
          }
        } catch (e) {
          // Not JSON, just log it
          console.log(`[Whisper] ${line}`);
        }
      });
    });

    pythonProcess.stderr.on("data", (data) => {
      errorBuffer += data.toString();
      console.error(`[Whisper Error] ${data.toString()}`);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Whisper process exited with code ${code}. Error: ${errorBuffer}`));
      }
    });

    pythonProcess.on("error", (err) => {
      reject(new Error(`Failed to start Python process: ${err.message}`));
    });
  });
}
