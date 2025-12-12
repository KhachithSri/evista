import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Analyze audio to detect if it contains speech
 * @param {string} audioPath - Path to audio file
 * @returns {Promise<object>} - Analysis result with speech detection
 */
export async function detectSpeechInAudio(audioPath) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'audioAnalyzer.py');
    const args = ['-3.10', pythonScript, audioPath];

    console.log(`Analyzing audio for speech content: ${audioPath}`);

    const pythonProcess = spawn('py', args);
    let outputData = '';
    let errorData = '';

    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.log('[Audio Analysis]', data.toString());
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Audio analysis error:', errorData);
        // Don't reject - return uncertain result
        resolve({
          success: false,
          has_speech: null,
          confidence: 0.0,
          error: errorData,
          uncertain: true
        });
        return;
      }

      try {
        const result = JSON.parse(outputData);
        console.log('Audio analysis result:', result);
        resolve(result);
      } catch (error) {
        console.error('Failed to parse audio analysis result:', error);
        resolve({
          success: false,
          has_speech: null,
          confidence: 0.0,
          error: error.message,
          uncertain: true
        });
      }
    });

    pythonProcess.on('error', (error) => {
      console.error('Failed to start audio analysis:', error);
      resolve({
        success: false,
        has_speech: null,
        confidence: 0.0,
        error: error.message,
        uncertain: true
      });
    });
  });
}
